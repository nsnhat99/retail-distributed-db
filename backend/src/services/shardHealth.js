/**
 * Shard Health Service
 * Monitors shard availability and provides list of available branches
 * When a shard goes down, queries will automatically exclude data from that branch
 */

const mongoose = require('mongoose');

// Branch to shard mapping
const BRANCH_SHARD_MAP = {
  'hanoi': 'shard1RS',
  'HN': 'shard1RS',
  'danang': 'shard2RS',
  'DN': 'shard2RS',
  'hcm': 'shard3RS',
  'HCM': 'shard3RS'
};

// Reverse mapping: shard to branches
const SHARD_BRANCHES = {
  'shard1RS': ['hanoi', 'HN'],
  'shard2RS': ['danang', 'DN'],
  'shard3RS': ['hcm', 'HCM']
};

// All valid branches
const ALL_BRANCHES = ['hanoi', 'HN', 'danang', 'DN', 'hcm', 'HCM'];

// Cache for shard health status
let shardHealthCache = {
  unavailableShards: new Set(),
  unavailableBranches: new Set(),
  lastCheck: null,
  checkInProgress: false
};

// Health check interval (5 seconds)
const HEALTH_CHECK_INTERVAL = 5000;

/**
 * Check health of all shards by querying each branch
 * Preserves manually marked unavailable shards and only removes them if health check confirms they're back online
 */
const checkShardHealth = async () => {
  if (shardHealthCache.checkInProgress) {
    return;
  }

  shardHealthCache.checkInProgress = true;

  try {
    const db = mongoose.connection.db;
    if (!db) {
      console.log('Database not connected yet');
      return;
    }

    // Start with current cache - preserve manually marked shards
    const newUnavailableShards = new Set(shardHealthCache.unavailableShards);
    const newUnavailableBranches = new Set(shardHealthCache.unavailableBranches);

    // Check each shard by querying a document from each branch
    for (const [shard, branches] of Object.entries(SHARD_BRANCHES)) {
      const testBranch = branches[0]; // Use first branch variant for testing

      try {
        // Quick query with short timeout to test shard availability
        await db.collection('products').findOne(
          { branch: testBranch },
          {
            maxTimeMS: 2000,
            readPreference: 'primaryPreferred'
          }
        );
        // Shard is available - remove from unavailable list if it was there
        if (newUnavailableShards.has(shard)) {
          newUnavailableShards.delete(shard);
          branches.forEach(b => newUnavailableBranches.delete(b));
          console.log(`Shard ${shard} is back online, branches restored: ${branches.join(', ')}`);
        }
      } catch (error) {
        if (error.message.includes('Could not find host matching read preference') ||
            error.message.includes('Server selection timed out') ||
            error.message.includes('not master') ||
            error.message.includes('node is recovering')) {

          // Add to unavailable list if not already there
          if (!newUnavailableShards.has(shard)) {
            newUnavailableShards.add(shard);
            branches.forEach(b => newUnavailableBranches.add(b));
            console.log(`Shard ${shard} unavailable, excluding branches: ${branches.join(', ')}`);
          }
        }
      }
    }

    // Update cache with merged results
    shardHealthCache.unavailableShards = newUnavailableShards;
    shardHealthCache.unavailableBranches = newUnavailableBranches;
    shardHealthCache.lastCheck = new Date();

    if (newUnavailableShards.size > 0) {
      console.log(`Current unavailable shards: ${Array.from(newUnavailableShards).join(', ')}`);
    }

  } catch (error) {
    console.error('Error checking shard health:', error.message);
  } finally {
    shardHealthCache.checkInProgress = false;
  }
};

/**
 * Get list of currently available branches
 */
const getAvailableBranches = () => {
  return ALL_BRANCHES.filter(b => !shardHealthCache.unavailableBranches.has(b));
};

/**
 * Get list of unavailable branches
 */
const getUnavailableBranches = () => {
  return Array.from(shardHealthCache.unavailableBranches);
};

/**
 * Check if a specific branch is available
 */
const isBranchAvailable = (branch) => {
  return !shardHealthCache.unavailableBranches.has(branch);
};

/**
 * Build a query filter that excludes unavailable branches
 * If specificBranch is provided and available, use it
 * Otherwise exclude unavailable branches from the query
 */
const buildBranchFilter = (specificBranch = null) => {
  const unavailableBranches = Array.from(shardHealthCache.unavailableBranches);

  if (specificBranch) {
    // If specific branch requested, check if it's available
    if (shardHealthCache.unavailableBranches.has(specificBranch)) {
      return {
        available: false,
        branch: specificBranch,
        message: `Branch "${specificBranch}" is currently unavailable (shard down)`
      };
    }
    return { available: true, filter: { branch: specificBranch } };
  }

  // No specific branch - exclude unavailable ones
  if (unavailableBranches.length === 0) {
    return { available: true, filter: {} };
  }

  return {
    available: true,
    filter: { branch: { $nin: unavailableBranches } },
    excludedBranches: unavailableBranches
  };
};

/**
 * Wrap a database operation with shard error handling
 * If operation fails due to shard unavailability, mark shard as down and retry
 */
const withShardFailover = async (operation, options = {}) => {
  const { retryWithoutBranch = true, branch = null } = options;

  try {
    return await operation();
  } catch (error) {
    // Check if this is a shard unavailability error
    if (error.message.includes('Could not find host matching read preference') ||
        error.message.includes('Server selection timed out')) {

      // Extract shard info from error if possible
      const shardMatch = error.message.match(/set (shard\d+RS)/);
      if (shardMatch) {
        const shard = shardMatch[1];
        shardHealthCache.unavailableShards.add(shard);

        if (SHARD_BRANCHES[shard]) {
          SHARD_BRANCHES[shard].forEach(b => shardHealthCache.unavailableBranches.add(b));
        }

        console.log(`Detected shard ${shard} failure, marked as unavailable`);
      }

      // If we can retry without the problematic branch
      if (retryWithoutBranch && !branch) {
        throw error; // Let the controller handle with filtered query
      }

      // Throw a more descriptive error
      const unavailableBranches = getUnavailableBranches();
      error.shardUnavailable = true;
      error.unavailableBranches = unavailableBranches;
      throw error;
    }

    throw error;
  }
};

/**
 * Start periodic health checking
 */
let healthCheckInterval = null;

const startHealthMonitoring = () => {
  if (healthCheckInterval) {
    return;
  }

  // Initial check after connection
  setTimeout(() => {
    checkShardHealth();
  }, 2000);

  // Periodic checks
  healthCheckInterval = setInterval(() => {
    checkShardHealth();
  }, HEALTH_CHECK_INTERVAL);

  console.log('Shard health monitoring started');
};

const stopHealthMonitoring = () => {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
    console.log('Shard health monitoring stopped');
  }
};

/**
 * Get current health status
 */
const getHealthStatus = () => {
  return {
    unavailableShards: Array.from(shardHealthCache.unavailableShards),
    unavailableBranches: Array.from(shardHealthCache.unavailableBranches),
    availableBranches: getAvailableBranches(),
    lastCheck: shardHealthCache.lastCheck,
    allShardsHealthy: shardHealthCache.unavailableShards.size === 0
  };
};

/**
 * Manually mark a shard as unavailable (called when query fails)
 */
const markShardUnavailable = (shardName) => {
  if (SHARD_BRANCHES[shardName]) {
    shardHealthCache.unavailableShards.add(shardName);
    SHARD_BRANCHES[shardName].forEach(b => shardHealthCache.unavailableBranches.add(b));
    console.log(`Shard ${shardName} marked as unavailable, branches: ${SHARD_BRANCHES[shardName].join(', ')}`);
  }
};

/**
 * Force a health check (useful after shard recovery)
 */
const forceHealthCheck = async () => {
  // Clear cache first
  shardHealthCache.unavailableShards = new Set();
  shardHealthCache.unavailableBranches = new Set();

  await checkShardHealth();
  return getHealthStatus();
};

module.exports = {
  checkShardHealth,
  getAvailableBranches,
  getUnavailableBranches,
  isBranchAvailable,
  buildBranchFilter,
  withShardFailover,
  startHealthMonitoring,
  stopHealthMonitoring,
  getHealthStatus,
  forceHealthCheck,
  markShardUnavailable,
  ALL_BRANCHES,
  BRANCH_SHARD_MAP,
  SHARD_BRANCHES
};
