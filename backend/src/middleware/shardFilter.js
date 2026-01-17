/**
 * Shard Filter Middleware
 * Automatically adds branch filtering to requests based on shard availability
 */

const {
  buildBranchFilter,
  isBranchAvailable,
  getUnavailableBranches,
  getHealthStatus
} = require('../services/shardHealth');
const { AppError } = require('./errorHandler');

/**
 * Middleware to attach shard health info to request
 * This allows controllers to check shard status and filter accordingly
 */
const attachShardHealth = (req, res, next) => {
  // Attach helper functions to request object
  req.shardHealth = {
    getUnavailableBranches,
    isBranchAvailable,
    buildBranchFilter,
    getHealthStatus
  };

  // Get the branch filter based on current shard health
  const userBranch = req.user?.branch;
  const queryBranch = req.query?.branch || req.body?.branch;
  const requestedBranch = queryBranch || (req.user?.role !== 'admin' ? userBranch : null);

  if (requestedBranch) {
    const branchCheck = buildBranchFilter(requestedBranch);

    if (!branchCheck.available) {
      // Branch is unavailable - attach error info but don't throw yet
      // Let controller decide how to handle
      req.shardHealth.branchUnavailable = true;
      req.shardHealth.unavailableBranch = requestedBranch;
      req.shardHealth.message = branchCheck.message;
    }
  }

  // Attach the current available branch filter
  req.shardHealth.currentFilter = buildBranchFilter(requestedBranch);

  next();
};

/**
 * Middleware that blocks requests to unavailable branches
 * Use this for write operations that MUST target a specific branch
 */
const requireAvailableBranch = (req, res, next) => {
  const branch = req.body?.branch || req.user?.branch;

  if (branch && !isBranchAvailable(branch)) {
    return next(new AppError(
      `Chi nhánh "${branch}" hiện không khả dụng. Shard đang bị down.`,
      503
    ));
  }

  next();
};

/**
 * Build query with automatic branch exclusion
 * Helper function for controllers to use
 */
const buildQueryWithAvailableBranches = (baseQuery = {}, options = {}) => {
  const { userRole, userBranch, requestedBranch } = options;
  const query = { ...baseQuery };

  // If user is not admin, they can only see their branch
  if (userRole !== 'admin') {
    // Check if user's branch is available
    if (!isBranchAvailable(userBranch)) {
      return {
        query: null,
        error: `Chi nhánh "${userBranch}" của bạn hiện không khả dụng`,
        unavailable: true
      };
    }
    query.branch = userBranch;
    return { query, unavailable: false };
  }

  // Admin case - can see multiple branches
  // If admin has a specific branch assigned (not super admin), use it unless they request another
  const effectiveBranch = requestedBranch || (userBranch ? userBranch : null);

  if (effectiveBranch) {
    // Admin requested specific branch or has assigned branch
    if (!isBranchAvailable(effectiveBranch)) {
      return {
        query: null,
        error: `Chi nhánh "${effectiveBranch}" hiện không khả dụng`,
        unavailable: true
      };
    }
    query.branch = effectiveBranch;
    return { query, unavailable: false };
  }

  // Super admin (branch = null) without specific branch filter - exclude unavailable branches
  const unavailableBranches = getUnavailableBranches();

  if (unavailableBranches.length > 0) {
    // MUST filter by available branches to avoid querying down shards
    const availableBranches = ['hanoi', 'danang', 'hcm'].filter(
      b => !unavailableBranches.includes(b)
    );
    query.branch = { $in: availableBranches };
    return {
      query,
      unavailable: false,
      excludedBranches: unavailableBranches,
      warning: `Một số chi nhánh không khả dụng: ${unavailableBranches.join(', ')}`
    };
  }

  return { query, unavailable: false };
};

module.exports = {
  attachShardHealth,
  requireAvailableBranch,
  buildQueryWithAvailableBranches
};
