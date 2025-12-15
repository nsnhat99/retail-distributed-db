import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"
import { toast } from "react-toastify"
import {
  HiOutlineLogout,
  HiOutlineBell,
  HiOutlineUser,
  HiOutlineChevronDown,
} from "react-icons/hi"

const Header = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [showDropdown, setShowDropdown] = useState(false)

  const handleLogout = async () => {
    await logout()
    toast.success("Đã đăng xuất")
    navigate("/login")
  }

  return (
    <header className="h-16 bg-white shadow-sm flex items-center justify-between px-6 sticky top-0 z-40">
      {/* Left side - Page Title (can be dynamic) */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800">
          Hệ thống quản lý bán lẻ phân tán
        </h2>
        <p className="text-sm text-gray-500">
          {new Date().toLocaleDateString("vi-VN", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Right side - User menu */}
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full relative">
          <HiOutlineBell className="w-6 h-6" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>

        {/* User Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
              <HiOutlineUser className="w-5 h-5 text-primary-700" />
            </div>
            <span className="text-sm font-medium text-gray-700">
              {user?.fullName}
            </span>
            <HiOutlineChevronDown
              className={`w-4 h-4 text-gray-500 transition-transform ${
                showDropdown ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* Dropdown Menu */}
          {showDropdown && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowDropdown(false)}
              ></div>
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border py-2 z-20">
                <div className="px-4 py-2 border-b">
                  <p className="text-sm font-medium text-gray-900">
                    {user?.fullName}
                  </p>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <HiOutlineLogout className="w-4 h-4" />
                  Đăng xuất
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

export default Header
