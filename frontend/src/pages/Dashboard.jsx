import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { statsAPI } from "../services/api"
import { useAuth } from "../context/AuthContext"
import { toast } from "react-toastify"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js"
import { Line, Bar, Doughnut } from "react-chartjs-2"
import {
  HiOutlineCurrencyDollar,
  HiOutlineUsers,
  HiOutlineCube,
  HiOutlineTrendingUp,
  HiOutlineExclamation,
} from "react-icons/hi"

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const Dashboard = () => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [revenue, setRevenue] = useState(null)
  const [topProducts, setTopProducts] = useState([])
  const [branchStats, setBranchStats] = useState([])

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const end = new Date(),
        start = new Date()
      start.setDate(start.getDate() - 30)
      const [o, r, t] = await Promise.all([
        statsAPI.getDashboard(),
        statsAPI.getRevenue({
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          groupBy: "day",
        }),
        statsAPI.getTopProducts({ limit: 5 }),
      ])
      setData(o.data.data)
      setRevenue(r.data.data)
      setTopProducts(t.data.data.topProducts)

      // Hiển thị warning nếu có chi nhánh không khả dụng
      if (o.data.warning) {
        toast.warning(o.data.warning)
      }

      if (user?.role === "admin") {
        const b = await statsAPI.getByBranch()
        setBranchStats(b.data.data.branchStats)

        // Hiển thị warning từ branch stats nếu có
        if (b.data.warning) {
          toast.warning(b.data.warning)
        }
      }
    } catch (e) {
      const message = e.response?.data?.message || "Không thể tải dữ liệu"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const fmt = (v) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(v)
  const revenueChart = {
    labels:
      revenue?.revenue?.map((i) =>
        new Date(i._id.year, i._id.month - 1, i._id.day).toLocaleDateString(
          "vi-VN",
          { day: "2-digit", month: "2-digit" }
        )
      ) || [],
    datasets: [
      {
        label: "Doanh thu",
        data: revenue?.revenue?.map((i) => i.totalRevenue) || [],
        borderColor: "rgb(59,130,246)",
        backgroundColor: "rgba(59,130,246,0.1)",
        fill: true,
        tension: 0.4,
      },
    ],
  }
  const topChart = {
    labels: topProducts.map((p) => p.productName?.substring(0, 15) + "..."),
    datasets: [
      {
        data: topProducts.map((p) => p.totalQuantitySold),
        backgroundColor: [
          "rgba(59,130,246,0.8)",
          "rgba(16,185,129,0.8)",
          "rgba(245,158,11,0.8)",
          "rgba(239,68,68,0.8)",
          "rgba(139,92,246,0.8)",
        ],
      },
    ],
  }
  const branchChart = {
    labels: branchStats.map(
      (b) => ({ hanoi: "Hà Nội", danang: "Đà Nẵng", hcm: "TP.HCM" }[b._id])
    ),
    datasets: [
      {
        data: branchStats.map((b) => b.totalRevenue),
        backgroundColor: [
          "rgba(59,130,246,0.8)",
          "rgba(16,185,129,0.8)",
          "rgba(245,158,11,0.8)",
        ],
      },
    ],
  }

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-gray-500">Tổng quan hệ thống</p>
        </div>
        <Link to="/orders/create" className="btn-primary">
          + Tạo đơn hàng
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Doanh thu hôm nay</p>
              <p className="text-2xl font-bold">
                {fmt(data?.today?.revenue || 0)}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <HiOutlineCurrencyDollar className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {data?.today?.orders || 0} đơn
          </p>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Doanh thu tháng</p>
              <p className="text-2xl font-bold">
                {fmt(data?.thisMonth?.revenue || 0)}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <HiOutlineTrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {data?.thisMonth?.orders || 0} đơn
          </p>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Sản phẩm</p>
              <p className="text-2xl font-bold">
                {data?.counts?.products || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <HiOutlineCube className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Khách hàng</p>
              <p className="text-2xl font-bold">
                {data?.counts?.customers || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <HiOutlineUsers className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card">
          <h3 className="text-lg font-semibold mb-4">Doanh thu 30 ngày</h3>
          <div className="h-80">
            <Line
              data={revenueChart}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true } },
              }}
            />
          </div>
        </div>
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">
            {user?.role === "admin" ? "Theo chi nhánh" : "Top sản phẩm"}
          </h3>
          <div className="h-64">
            {user?.role === "admin" && branchStats.length ? (
              <Doughnut
                data={branchChart}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: "bottom" } },
                }}
              />
            ) : (
              <Bar
                data={topChart}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  indexAxis: "y",
                  plugins: { legend: { display: false } },
                }}
              />
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Top 5 bán chạy</h3>
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 text-sm text-gray-500">
                  Sản phẩm
                </th>
                <th className="text-right py-3 text-sm text-gray-500">
                  Đã bán
                </th>
                <th className="text-right py-3 text-sm text-gray-500">
                  Doanh thu
                </th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((p, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-3 text-sm">{p.productName}</td>
                  <td className="py-3 text-sm text-right">
                    {p.totalQuantitySold}
                  </td>
                  <td className="py-3 text-sm text-right font-medium">
                    {fmt(p.totalRevenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Cảnh báo tồn kho</h3>
            <span className="badge-warning">
              <HiOutlineExclamation className="w-4 h-4 mr-1" />
              {data?.lowStockProducts?.length || 0}
            </span>
          </div>
          <div className="space-y-3">
            {data?.lowStockProducts?.length ? (
              data.lowStockProducts.map((p) => (
                <div
                  key={p._id}
                  className="flex items-center justify-between p-3 bg-red-50 rounded-lg"
                >
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-gray-500">SKU: {p.sku}</p>
                  </div>
                  <span className="badge-danger">{p.stock}</span>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-500 py-8">
                Không có cảnh báo
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Đơn hàng gần đây</h3>
          <Link to="/orders" className="text-sm text-primary-600">
            Xem tất cả →
          </Link>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-3 text-sm text-gray-500">Mã đơn</th>
              <th className="text-left py-3 text-sm text-gray-500">
                Khách hàng
              </th>
              <th className="text-right py-3 text-sm text-gray-500">
                Tổng tiền
              </th>
              <th className="text-center py-3 text-sm text-gray-500">
                Trạng thái
              </th>
              <th className="text-right py-3 text-sm text-gray-500">
                Thời gian
              </th>
            </tr>
          </thead>
          <tbody>
            {data?.recentOrders?.map((o) => (
              <tr key={o._id} className="border-b last:border-0">
                <td className="py-3 text-sm font-medium text-primary-600">
                  {o.orderCode}
                </td>
                <td className="py-3 text-sm">
                  {o.customerName || "Khách vãng lai"}
                </td>
                <td className="py-3 text-sm text-right font-medium">
                  {fmt(o.finalAmount)}
                </td>
                <td className="py-3 text-center">
                  <span
                    className={`badge ${
                      o.status === "completed"
                        ? "badge-success"
                        : o.status === "cancelled"
                        ? "badge-danger"
                        : "badge-warning"
                    }`}
                  >
                    {o.status === "completed"
                      ? "Hoàn thành"
                      : o.status === "cancelled"
                      ? "Đã hủy"
                      : "Chờ xử lý"}
                  </span>
                </td>
                <td className="py-3 text-sm text-right text-gray-500">
                  {new Date(o.createdAt).toLocaleString("vi-VN")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default Dashboard
