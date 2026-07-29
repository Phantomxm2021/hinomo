import { createBrowserRouter } from 'react-router-dom'
import { RequireAuth } from './RequireAuth'
import { LoginPlaceholder, PlaceholderPage } from './RoutePlaceholders'

export const router = createBrowserRouter([
  { path: '/', element: <PlaceholderPage title="Nomo" /> },
  { path: '/login', element: <LoginPlaceholder /> },
  { path: '/register', element: <PlaceholderPage title="注册" /> },
  { path: '/forgot-password', element: <PlaceholderPage title="忘记密码" /> },
  { path: '/reset-password', element: <PlaceholderPage title="重置密码" /> },
  { path: '/b/:publicId', element: <PlaceholderPage title="收纳箱" /> },
  {
    path: '/app/*',
    element: <RequireAuth />,
    children: [{ path: '*', element: <PlaceholderPage title="我的收纳" /> }],
  },
])
