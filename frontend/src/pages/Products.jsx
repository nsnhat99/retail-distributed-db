import { useState, useEffect } from "react"
import { productAPI } from "../services/api"
import { useAuth } from "../context/AuthContext"
import { toast } from "react-toastify"
import {
  HiOutlinePlus,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineSearch,
  HiOutlineX,
} from "react-icons/hi"

const Products = () => {
  const { user } = useAuth()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
  })
  const [filters, setFilters] = useState({
    search: "",
    category: "",
    branch: "",
  })
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({
    sku: "",
    name: "",
    description: "",
    category: "other",
    price: "",
    costPrice: "",
    stock: "",
    unit: "item",
    supplier: "",
    branch: "",
  })
  const categories = [
    { value: "electronics", label: "Điện tử" },
    { value: "clothing", label: "Thời trang" },
    { value: "food", label: "Thực phẩm" },
    { value: "furniture", label: "Nội thất" },
    { value: "books", label: "Sách" },
    { value: "sports", label: "Thể thao" },
    { value: "beauty", label: "Làm đẹp" },
    { value: "toys", label: "Đồ chơi" },
    { value: "other", label: "Khác" },
  ]

  useEffect(() => {
    fetchProducts()
  }, [pagination.currentPage, filters])

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const params = { page: pagination.currentPage, limit: 10, ...filters }
      Object.keys(params).forEach((k) => !params[k] && delete params[k])
      const res = await productAPI.getAll(params)
      setProducts(res.data.data.products)
      setPagination(res.data.data.pagination)

      // Hiển thị warning nếu có chi nhánh không khả dụng
      if (res.data.warning) {
        toast.warning(res.data.warning)
      }
    } catch (e) {
      const message = e.response?.data?.message || "Không thể tải sản phẩm"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editing) {
        await productAPI.update(editing._id, form)
        toast.success("Cập nhật thành công")
      } else {
        await productAPI.create(form)
        toast.success("Thêm thành công")
      }
      setShowModal(false)
      resetForm()
      fetchProducts()
    } catch (e) {
      toast.error(e.response?.data?.message || "Có lỗi xảy ra")
    }
  }

  const handleDelete = async (id, productBranch) => {
    if (!window.confirm("Xóa sản phẩm này?")) return
    try {
      await productAPI.delete(id, productBranch)
      toast.success("Đã xóa")
      fetchProducts()
    } catch (e) {
      const message = e.response?.data?.message || "Không thể xóa"
      toast.error(message)
    }
  }

  const openEdit = (p) => {
    setEditing(p)
    setForm({
      sku: p.sku,
      name: p.name,
      description: p.description || "",
      category: p.category,
      price: p.price,
      costPrice: p.costPrice || "",
      stock: p.stock,
      unit: p.unit,
      supplier: p.supplier || "",
      branch: p.branch || "",
    })
    setShowModal(true)
  }
  const resetForm = () => {
    setEditing(null)
    setForm({
      sku: "",
      name: "",
      description: "",
      category: "other",
      price: "",
      costPrice: "",
      stock: "",
      unit: "item",
      supplier: "",
      branch: "",
    })
  }
  const fmt = (v) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(v)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Sản phẩm</h1>
          <p className="text-gray-500">Tổng: {pagination.totalItems}</p>
        </div>
        {["admin", "staff"].includes(user?.role) && (
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
        )}
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
            value={filters.category}
            onChange={(e) => {
              setFilters({ ...filters, category: e.target.value })
              setPagination((prev) => ({ ...prev, currentPage: 1 }))
            }}
          >
            <option value="">Tất cả danh mục</option>
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
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
          <button
            onClick={() => {
              setFilters({ search: "", category: "", branch: "" })
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
                  SKU
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">
                  Sản phẩm
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">
                  Danh mục
                </th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase">
                  Giá
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase">
                  Kho
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase">
                  CN
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {products.map((p) => (
                <tr key={p._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-mono text-gray-600">
                    {p.sku}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-800">
                    {p.name}
                  </td>
                  <td className="px-6 py-4">
                    <span className="badge-info">
                      {categories.find((c) => c.value === p.category)?.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium">
                    {fmt(p.price)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`badge ${
                        p.stock < 10
                          ? "badge-danger"
                          : p.stock < 50
                          ? "badge-warning"
                          : "badge-success"
                      }`}
                    >
                      {p.stock}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center text-sm capitalize">
                    {p.branch === "hcm"
                      ? "HCM"
                      : p.branch === "danang"
                      ? "ĐN"
                      : "HN"}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => openEdit(p)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      >
                        <HiOutlinePencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(p._id, p.branch)}
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold">
                {editing ? "Cập nhật" : "Thêm mới"}
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
                    SKU *
                  </label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    value={form.sku}
                    onChange={(e) =>
                      setForm({ ...form, sku: e.target.value.toUpperCase() })
                    }
                    disabled={!!editing}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Danh mục *
                  </label>
                  <select
                    required
                    className="input-field"
                    value={form.category}
                    onChange={(e) =>
                      setForm({ ...form, category: e.target.value })
                    }
                  >
                    {categories.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tên *</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Mô tả</label>
                <textarea
                  className="input-field"
                  rows="2"
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                ></textarea>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Giá bán *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    className="input-field"
                    value={form.price}
                    onChange={(e) =>
                      setForm({ ...form, price: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Giá vốn
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="input-field"
                    value={form.costPrice}
                    onChange={(e) =>
                      setForm({ ...form, costPrice: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Tồn kho *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    className="input-field"
                    value={form.stock}
                    onChange={(e) =>
                      setForm({ ...form, stock: e.target.value })
                    }
                  />
                </div>
              </div>
              {user?.role === "admin" && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Chi nhánh {!user?.branch && "*"}
                  </label>
                  <select
                    required={!user?.branch}
                    className="input-field"
                    value={form.branch}
                    onChange={(e) =>
                      setForm({ ...form, branch: e.target.value })
                    }
                  >
                    <option value="">
                      {user?.branch ? "Giữ nguyên chi nhánh" : "Chọn chi nhánh"}
                    </option>
                    <option value="hanoi">Hà Nội</option>
                    <option value="danang">Đà Nẵng</option>
                    <option value="hcm">TP.HCM</option>
                  </select>
                </div>
              )}
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

export default Products
