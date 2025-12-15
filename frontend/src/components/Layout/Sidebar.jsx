import { NavLink } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"
import {
  HiOutlineHome,
  HiOutlineShoppingBag,
  HiOutlineClipboardList,
  HiOutlineUsers,
  HiOutlineChartBar,
  HiOutlineDatabase,
} from "react-icons/hi"

const Sidebar = () => {
  const { user } = useAuth()

  const menuItems = [
    {
      name: "Dashboard",
      path: "/dashboard",
      icon: HiOutlineHome,
      roles: ["admin", "staff"],
    },
    {
      name: "Sản phẩm",
      path: "/products",
      icon: HiOutlineShoppingBag,
      roles: ["admin", "staff"],
    },
    {
      name: "Đơn hàng",
      path: "/orders",
      icon: HiOutlineClipboardList,
      roles: ["admin", "staff"],
    },
    {
      name: "Người dùng",
      path: "/users",
      icon: HiOutlineUsers,
      roles: ["admin"],
    },
  ]

  const filteredMenu = menuItems.filter((item) =>
    item.roles.includes(user?.role)
  )

  const branchNames = {
    hanoi: "Hà Nội",
    danang: "Đà Nẵng",
    hcm: "TP. HCM",
  }

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-white shadow-lg z-50">
      {/* Logo */}
      <div className="h-16 flex items-center justify-center border-b">
        <div className="flex items-center gap-2">
          <HiOutlineDatabase className="w-8 h-8 text-primary-600" />
          <div>
            <h1 className="font-bold text-lg text-gray-800">Retail System</h1>
            <p className="text-xs text-gray-500">Distributed Database</p>
          </div>
        </div>
      </div>

      {/* Branch Badge */}
      <div className="px-4 py-3 bg-primary-50 border-b">
        <p className="text-xs text-gray-500">Chi nhánh</p>
        <p className="font-semibold text-primary-700">
          {branchNames[user?.branch] || user?.branch}
        </p>
      </div>

      {/* Navigation */}
      <nav className="p-4">
        <ul className="space-y-2">
          {filteredMenu.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? "bg-primary-50 text-primary-700 font-medium"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`
                }
              >
                <item.icon className="w-5 h-5" />
                <span>{item.name}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-gray-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
            <span className="text-primary-700 font-semibold">
              {user?.fullName?.charAt(0) || "U"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.fullName}
            </p>
            <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
          </div>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
