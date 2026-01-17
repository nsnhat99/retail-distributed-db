import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { orderAPI } from "../services/api"
import { useAuth } from "../context/AuthContext"
import { toast } from "react-toastify"
import {
  HiOutlinePlus,
  HiOutlineEye,
  HiOutlineX,
  HiOutlineCheck,
  HiOutlineBan,
} from "react-icons/hi"

const Orders = () => {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
  })
  const [filters, setFilters] = useState({
    status: "",
    branch: "",
    startDate: "",
    endDate: "",
  })
  const [selectedOrder, setSelectedOrder] = useState(null)

  useEffect(() => {
    fetchOrders()
  }, [pagination.currentPage, filters])

  const fetchOrders = async () => {
    try {
      setLoading(true)
      const params = { page: pagination.currentPage, limit: 10, ...filters }
      Object.keys(params).forEach((k) => !params[k] && delete params[k])
      const res = await orderAPI.getAll(params)
      setOrders(res.data.data.orders)
      setPagination(res.data.data.pagination)

      // Hiển thị warning nếu có chi nhánh không khả dụng
      if (res.data.warning) {
        toast.warning(res.data.warning)
      }
    } catch (e) {
      const message = e.response?.data?.message || "Không thể tải đơn hàng"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (id, status, orderBranch) => {
    try {
      await orderAPI.updateStatus(id, status, orderBranch)
      toast.success("Cập nhật trạng thái thành công")
      fetchOrders()
      if (selectedOrder?._id === id) {
        const res = await orderAPI.getById(id)
        setSelectedOrder(res.data.data.order)
      }
    } catch (e) {
      const message = e.response?.data?.message || "Không thể cập nhật"
      toast.error(message)
    }
  }

  const handleCancel = async (id, orderBranch) => {
    if (!window.confirm("Hủy đơn hàng này?")) return
    try {
      await orderAPI.cancel(id, orderBranch)
      toast.success("Đã hủy đơn")
      fetchOrders()
    } catch (e) {
      const message = e.response?.data?.message || "Không thể hủy"
      toast.error(message)
    }
  }

  const viewOrder = async (id) => {
    try {
      const res = await orderAPI.getById(id)
      setSelectedOrder(res.data.data.order)
    } catch (e) {
      toast.error("Không thể tải chi tiết")
    }
  }

  const fmt = (v) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(v)
  const statusMap = {
    pending: { label: "Chờ xử lý", class: "badge-warning" },
    confirmed: { label: "Đã xác nhận", class: "badge-info" },
    completed: { label: "Hoàn thành", class: "badge-success" },
    cancelled: { label: "Đã hủy", class: "badge-danger" },
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Đơn hàng</h1>
          <p className="text-gray-500">Tổng: {pagination.totalItems}</p>
        </div>
        <Link
          to="/orders/create"
          className="btn-primary flex items-center gap-2"
        >
          <HiOutlinePlus className="w-5 h-5" />
          Tạo đơn
        </Link>
      </div>

      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <select
            className="input-field"
            value={filters.status}
            onChange={(e) => {
              setFilters({ ...filters, status: e.target.value })
              setPagination((prev) => ({ ...prev, currentPage: 1 }))
            }}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="pending">Chờ xử lý</option>
            <option value="confirmed">Đã xác nhận</option>
            <option value="completed">Hoàn thành</option>
            <option value="cancelled">Đã hủy</option>
          </select>
          {user?.role === "admin" && (
            <select
              className="input-field"
              value={filters.branch}
              onChange={(e) => {
                setFilters({ ...filters, branch: e.target.value })
                setPagination((prev) => ({ ...prev, currentPage: 1 }))
              }}
            >
              <option value="">Tất cả chi nhánh</option>
              <option value="hanoi">Hà Nội</option>
              <option value="danang">Đà Nẵng</option>
              <option value="hcm">TP.HCM</option>
            </select>
          )}
          <input
            type="date"
            className="input-field"
            value={filters.startDate}
            onChange={(e) => {
              setFilters({ ...filters, startDate: e.target.value })
              setPagination((prev) => ({ ...prev, currentPage: 1 }))
            }}
            placeholder="Từ ngày"
          />
          <input
            type="date"
            className="input-field"
            value={filters.endDate}
            onChange={(e) => {
              setFilters({ ...filters, endDate: e.target.value })
              setPagination((prev) => ({ ...prev, currentPage: 1 }))
            }}
            placeholder="Đến ngày"
          />
          <button
            onClick={() => {
              setFilters({ status: "", branch: "", startDate: "", endDate: "" })
              setPagination({ ...pagination, currentPage: 1 })
            }}
            className="btn-secondary"
          >
            Xóa lọc
          </button>
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">
                  Mã đơn
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">
                  Khách hàng
                </th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase">
                  Tổng tiền
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase">
                  Trạng thái
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase">
                  CN
                </th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase">
                  Ngày tạo
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((o) => (
                <tr key={o._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-primary-600">
                    {o.orderCode}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium">
                      {o.customerName || "Khách vãng lai"}
                    </p>
                    <p className="text-xs text-gray-500">{o.customerPhone}</p>
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium">
                    {fmt(o.finalAmount)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`badge ${statusMap[o.status]?.class}`}>
                      {statusMap[o.status]?.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center text-sm capitalize">
                    {o.branch === "hcm"
                      ? "HCM"
                      : o.branch === "danang"
                      ? "ĐN"
                      : "HN"}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-gray-500">
                    {new Date(o.createdAt).toLocaleString("vi-VN")}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => viewOrder(o._id)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                        title="Xem"
                      >
                        <HiOutlineEye className="w-4 h-4" />
                      </button>
                      {o.status === "pending" && (
                        <>
                          <button
                            onClick={() =>
                              handleStatusChange(o._id, "confirmed", o.branch)
                            }
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                            title="Xác nhận"
                          >
                            <HiOutlineCheck className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleCancel(o._id, o.branch)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                            title="Hủy"
                          >
                            <HiOutlineBan className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {o.status === "confirmed" && (
                        <button
                          onClick={() => handleStatusChange(o._id, "completed", o.branch)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="Hoàn thành"
                        >
                          <HiOutlineCheck className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Trang {pagination.currentPage}/{pagination.totalPages}
          </p>
          <div className="flex gap-2">
            <button
              disabled={pagination.currentPage === 1}
              onClick={() =>
                setPagination({
                  ...pagination,
                  currentPage: pagination.currentPage - 1,
                })
              }
              className="btn-secondary disabled:opacity-50"
            >
              Trước
            </button>
            <button
              disabled={pagination.currentPage === pagination.totalPages}
              onClick={() =>
                setPagination({
                  ...pagination,
                  currentPage: pagination.currentPage + 1,
                })
              }
              className="btn-secondary disabled:opacity-50"
            >
              Sau
            </button>
          </div>
        </div>
      )}

      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold">
                Chi tiết đơn #{selectedOrder.orderCode}
              </h2>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Khách hàng</p>
                  <p className="font-medium">
                    {selectedOrder.customerName || "Khách vãng lai"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">SĐT</p>
                  <p className="font-medium">
                    {selectedOrder.customerPhone || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Trạng thái</p>
                  <span
                    className={`badge ${
                      statusMap[selectedOrder.status]?.class
                    }`}
                  >
                    {statusMap[selectedOrder.status]?.label}
                  </span>
                </div>
                <div>
                  <p className="text-gray-500">Thanh toán</p>
                  <p className="font-medium capitalize">
                    {selectedOrder.paymentMethod}
                  </p>
                </div>
              </div>
              <div className="border-t pt-4">
                <h3 className="font-medium mb-3">Sản phẩm</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Sản phẩm</th>
                      <th className="text-right py-2">Giá</th>
                      <th className="text-center py-2">SL</th>
                      <th className="text-right py-2">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items?.map((item, i) => (
                      <tr key={i} className="border-b">
                        <td className="py-2">{item.productName}</td>
                        <td className="py-2 text-right">{fmt(item.price)}</td>
                        <td className="py-2 text-center">{item.quantity}</td>
                        <td className="py-2 text-right font-medium">
                          {fmt(item.subtotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t pt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Tạm tính</span>
                  <span>{fmt(selectedOrder.totalAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Giảm giá</span>
                  <span>-{fmt(selectedOrder.discount || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Thuế</span>
                  <span>{fmt(selectedOrder.tax || 0)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Tổng cộng</span>
                  <span className="text-primary-600">
                    {fmt(selectedOrder.finalAmount)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Orders
