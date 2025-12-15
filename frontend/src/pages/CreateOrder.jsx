import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { productAPI, orderAPI, userAPI } from "../services/api"
import { toast } from "react-toastify"
import { HiOutlinePlus, HiOutlineTrash, HiOutlineSearch } from "react-icons/hi"

const CreateOrder = () => {
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchProduct, setSearchProduct] = useState("")
  const [searchCustomer, setSearchCustomer] = useState("")
  const [cart, setCart] = useState([])
  const [form, setForm] = useState({
    customerId: "",
    customerName: "",
    customerPhone: "",
    paymentMethod: "cash",
    note: "",
    discount: 0,
  })

  useEffect(() => {
    fetchProducts()
    fetchCustomers()
  }, [])

  const fetchProducts = async () => {
    try {
      const res = await productAPI.getAll({ limit: 100, inStock: "true" })
      setProducts(res.data.data.products)
    } catch (e) {
      toast.error("Không thể tải sản phẩm")
    }
  }

  const fetchCustomers = async () => {
    try {
      const res = await userAPI.getCustomers({ limit: 100 })
      setCustomers(res.data.data.customers)
    } catch (e) {
      console.log("Không thể tải khách hàng")
    }
  }

  const addToCart = (product) => {
    const existing = cart.find((item) => item.productId === product._id)
    if (existing) {
      if (existing.quantity >= product.stock) {
        toast.error("Không đủ hàng")
        return
      }
      setCart(
        cart.map((item) =>
          item.productId === product._id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      )
    } else {
      setCart([
        ...cart,
        {
          productId: product._id,
          productName: product.name,
          price: product.price,
          quantity: 1,
          maxStock: product.stock,
        },
      ])
    }
  }

  const updateQuantity = (productId, qty) => {
    const item = cart.find((i) => i.productId === productId)
    if (qty > item.maxStock) {
      toast.error("Không đủ hàng")
      return
    }
    if (qty < 1) {
      removeFromCart(productId)
      return
    }
    setCart(
      cart.map((i) => (i.productId === productId ? { ...i, quantity: qty } : i))
    )
  }

  const removeFromCart = (productId) =>
    setCart(cart.filter((i) => i.productId !== productId))

  const selectCustomer = (customer) => {
    setForm({
      ...form,
      customerId: customer._id,
      customerName: customer.fullName,
      customerPhone: customer.phone || "",
    })
    setSearchCustomer("")
  }

  const totalAmount = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  )
  const tax = Math.round(totalAmount * 0.1)
  const finalAmount = totalAmount - (form.discount || 0) + tax

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (cart.length === 0) {
      toast.error("Vui lòng thêm sản phẩm")
      return
    }
    setLoading(true)
    try {
      const orderData = {
        ...form,
        items: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        discount: form.discount || 0,
        tax,
      }
      await orderAPI.create(orderData)
      toast.success("Tạo đơn hàng thành công!")
      navigate("/orders")
    } catch (e) {
      toast.error(e.response?.data?.message || "Không thể tạo đơn")
    } finally {
      setLoading(false)
    }
  }

  const fmt = (v) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(v)
  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchProduct.toLowerCase())
  )
  const filteredCustomers = customers.filter(
    (c) =>
      c.fullName.toLowerCase().includes(searchCustomer.toLowerCase()) ||
      (c.phone && c.phone.includes(searchCustomer))
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Tạo đơn hàng mới</h1>
        <p className="text-gray-500">Thêm sản phẩm và thông tin khách hàng</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Products Selection */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card">
            <h3 className="font-semibold mb-4">Chọn sản phẩm</h3>
            <div className="relative mb-4">
              <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Tìm sản phẩm..."
                className="input-field pl-10"
                value={searchProduct}
                onChange={(e) => setSearchProduct(e.target.value)}
              />
            </div>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {filteredProducts.slice(0, 20).map((p) => (
                <div
                  key={p._id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                >
                  <div>
                    <p className="font-medium text-sm">{p.name}</p>
                    <p className="text-xs text-gray-500">
                      {p.sku} - Kho: {p.stock}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-sm">{fmt(p.price)}</span>
                    <button
                      onClick={() => addToCart(p)}
                      className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg"
                    >
                      <HiOutlinePlus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cart */}
          <div className="card">
            <h3 className="font-semibold mb-4">
              Giỏ hàng ({cart.length} sản phẩm)
            </h3>
            {cart.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Chưa có sản phẩm</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 text-sm text-gray-500">
                      Sản phẩm
                    </th>
                    <th className="text-right py-2 text-sm text-gray-500">
                      Giá
                    </th>
                    <th className="text-center py-2 text-sm text-gray-500">
                      SL
                    </th>
                    <th className="text-right py-2 text-sm text-gray-500">
                      Thành tiền
                    </th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item) => (
                    <tr key={item.productId} className="border-b">
                      <td className="py-3 text-sm font-medium">
                        {item.productName}
                      </td>
                      <td className="py-3 text-sm text-right">
                        {fmt(item.price)}
                      </td>
                      <td className="py-3 text-center">
                        <input
                          type="number"
                          min="1"
                          max={item.maxStock}
                          className="w-16 input-field text-center py-1"
                          value={item.quantity}
                          onChange={(e) =>
                            updateQuantity(
                              item.productId,
                              parseInt(e.target.value) || 1
                            )
                          }
                        />
                      </td>
                      <td className="py-3 text-sm text-right font-medium">
                        {fmt(item.price * item.quantity)}
                      </td>
                      <td className="py-3 text-center">
                        <button
                          onClick={() => removeFromCart(item.productId)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                        >
                          <HiOutlineTrash className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Order Summary */}
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-semibold mb-4">Thông tin khách hàng</h3>
            <div className="space-y-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Tìm khách hàng..."
                  className="input-field"
                  value={searchCustomer}
                  onChange={(e) => setSearchCustomer(e.target.value)}
                />
                {searchCustomer && filteredCustomers.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto z-10">
                    {filteredCustomers.slice(0, 5).map((c) => (
                      <button
                        key={c._id}
                        onClick={() => selectCustomer(c)}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50"
                      >
                        <p className="font-medium text-sm">{c.fullName}</p>
                        <p className="text-xs text-gray-500">{c.phone}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Tên khách hàng
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={form.customerName}
                  onChange={(e) =>
                    setForm({ ...form, customerName: e.target.value })
                  }
                  placeholder="Nhập tên hoặc để trống"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">SĐT</label>
                <input
                  type="text"
                  className="input-field"
                  value={form.customerPhone}
                  onChange={(e) =>
                    setForm({ ...form, customerPhone: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold mb-4">Thanh toán</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Phương thức
                </label>
                <select
                  className="input-field"
                  value={form.paymentMethod}
                  onChange={(e) =>
                    setForm({ ...form, paymentMethod: e.target.value })
                  }
                >
                  <option value="cash">Tiền mặt</option>
                  <option value="card">Thẻ</option>
                  <option value="transfer">Chuyển khoản</option>
                  <option value="ewallet">Ví điện tử</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Giảm giá (VNĐ)
                </label>
                <input
                  type="number"
                  min="0"
                  className="input-field"
                  value={form.discount}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      discount: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Ghi chú
                </label>
                <textarea
                  className="input-field"
                  rows="2"
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                ></textarea>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold mb-4">Tổng kết</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Tạm tính</span>
                <span>{fmt(totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Giảm giá</span>
                <span>-{fmt(form.discount || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Thuế (10%)</span>
                <span>{fmt(tax)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Tổng cộng</span>
                <span className="text-primary-600">{fmt(finalAmount)}</span>
              </div>
            </div>
            <button
              onClick={handleSubmit}
              disabled={loading || cart.length === 0}
              className="w-full btn-primary mt-4 disabled:opacity-50"
            >
              {loading ? "Đang xử lý..." : "Tạo đơn hàng"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CreateOrder
