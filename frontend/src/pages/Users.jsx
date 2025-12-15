import { useState, useEffect } from "react"
import { userAPI } from "../services/api"
import { toast } from "react-toastify"
import {
  HiOutlinePlus,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineSearch,
  HiOutlineX,
  HiOutlineKey,
} from "react-icons/hi"

const Users = () => {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
  })
  const [filters, setFilters] = useState({ search: "", role: "", branch: "" })
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({
    username: "",
    password: "",
    fullName: "",
    email: "",
    phone: "",
    role: "staff",
    branch: "hanoi",
  })

  useEffect(() => {
    fetchUsers()
  }, [pagination.currentPage, filters])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const params = { page: pagination.currentPage, limit: 10, ...filters }
      Object.keys(params).forEach((k) => !params[k] && delete params[k])
      const res = await userAPI.getAll(params)
      setUsers(res.data.data.users)
      setPagination(res.data.data.pagination)
    } catch (e) {
      toast.error("Không thể tải người dùng")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editing) {
        await userAPI.update(editing._id, form)
        toast.success("Cập nhật thành công")
      } else {
        await userAPI.create(form)
        toast.success("Thêm thành công")
      }
      setShowModal(false)
      resetForm()
      fetchUsers()
    } catch (e) {
      toast.error(e.response?.data?.message || "Có lỗi xảy ra")
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm("Vô hiệu hóa người dùng này?")) return
    try {
      await userAPI.delete(id)
      toast.success("Đã vô hiệu hóa")
      fetchUsers()
    } catch (e) {
      toast.error("Không thể vô hiệu hóa")
    }
  }

  const handleResetPassword = async (id) => {
    const newPass = prompt("Nhập mật khẩu mới (tối thiểu 6 ký tự):")
    if (!newPass || newPass.length < 6) {
      toast.error("Mật khẩu phải có ít nhất 6 ký tự")
      return
    }
    try {
      await userAPI.resetPassword(id, { newPassword: newPass })
      toast.success("Đã đặt lại mật khẩu")
    } catch (e) {
      toast.error("Không thể đặt lại mật khẩu")
    }
  }

  const openEdit = (u) => {
    setEditing(u)
    setForm({
      username: u.username,
      password: "",
      fullName: u.fullName,
      email: u.email,
      phone: u.phone || "",
      role: u.role,
      branch: u.branch,
    })
    setShowModal(true)
  }
  const resetForm = () => {
    setEditing(null)
    setForm({
      username: "",
      password: "",
      fullName: "",
      email: "",
      phone: "",
      role: "staff",
      branch: "hanoi",
    })
  }

  const roleMap = {
    admin: "Quản trị",
    staff: "Nhân viên",
    customer: "Khách hàng",
  }
  const branchMap = { hanoi: "Hà Nội", danang: "Đà Nẵng", hcm: "TP.HCM" }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Người dùng</h1>
          <p className="text-gray-500">Tổng: {pagination.totalItems}</p>
        </div>
        <button
          onClick={() => {
            resetForm()
            setShowModal(true)
          }}
          className="btn-primary flex items-center gap-2"
        >
          <HiOutlinePlus className="w-5 h-5" />
          Thêm
        </button>
      </div>

      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm..."
              className="input-field pl-10"
              value={filters.search}
              onChange={(e) => {
                setFilters({ ...filters, search: e.target.value })
                setPagination((prev) => ({ ...prev, currentPage: 1 }))
              }}
            />
          </div>
          <select
            className="input-field"
            value={filters.role}
            onChange={(e) => {
              setFilters({ ...filters, role: e.target.value })
              setPagination((prev) => ({ ...prev, currentPage: 1 }))
            }}
          >
            <option value="">Tất cả vai trò</option>
            <option value="admin">Quản trị</option>
            <option value="staff">Nhân viên</option>
            <option value="customer">Khách hàng</option>
          </select>
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
          <button
            onClick={() => {
              setFilters({ search: "", role: "", branch: "" })
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
                  Username
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">
                  Họ tên
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">
                  Email
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase">
                  Vai trò
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase">
                  CN
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase">
                  TT
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((u) => (
                <tr key={u._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-mono text-gray-600">
                    {u.username}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-800">
                    {u.fullName}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{u.email}</td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`badge ${
                        u.role === "admin"
                          ? "badge-danger"
                          : u.role === "staff"
                          ? "badge-info"
                          : "badge-success"
                      }`}
                    >
                      {roleMap[u.role]}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center text-sm">
                    {branchMap[u.branch]}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`badge ${
                        u.isActive ? "badge-success" : "badge-danger"
                      }`}
                    >
                      {u.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => openEdit(u)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      >
                        <HiOutlinePencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleResetPassword(u._id)}
                        className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg"
                      >
                        <HiOutlineKey className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(u._id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <HiOutlineTrash className="w-4 h-4" />
                      </button>
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

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold">
                {editing ? "Cập nhật" : "Thêm người dùng"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Username *
                  </label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    value={form.username}
                    onChange={(e) =>
                      setForm({ ...form, username: e.target.value })
                    }
                    disabled={!!editing}
                  />
                </div>
                {!editing && (
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Mật khẩu *
                    </label>
                    <input
                      type="password"
                      required
                      className="input-field"
                      value={form.password}
                      onChange={(e) =>
                        setForm({ ...form, password: e.target.value })
                      }
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Họ tên *
                </label>
                <input
                  type="text"
                  required
                  className="input-field"
                  value={form.fullName}
                  onChange={(e) =>
                    setForm({ ...form, fullName: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    className="input-field"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">SĐT</label>
                  <input
                    type="text"
                    className="input-field"
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Vai trò *
                  </label>
                  <select
                    required
                    className="input-field"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                  >
                    <option value="admin">Quản trị</option>
                    <option value="staff">Nhân viên</option>
                    <option value="customer">Khách hàng</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Chi nhánh *
                  </label>
                  <select
                    required
                    className="input-field"
                    value={form.branch}
                    onChange={(e) =>
                      setForm({ ...form, branch: e.target.value })
                    }
                  >
                    <option value="hanoi">Hà Nội</option>
                    <option value="danang">Đà Nẵng</option>
                    <option value="hcm">TP.HCM</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary"
                >
                  Hủy
                </button>
                <button type="submit" className="btn-primary">
                  {editing ? "Cập nhật" : "Thêm"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Users
