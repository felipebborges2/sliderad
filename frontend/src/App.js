import { AuthProvider, useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ServerWakeup from './components/ServerWakeup';

function Routes() {
  const { usuario } = useAuth();
  return usuario ? <DashboardPage /> : <LoginPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <ServerWakeup />
      <Routes />
    </AuthProvider>
  );
}
