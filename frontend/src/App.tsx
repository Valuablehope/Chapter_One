import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import SplashScreen from './pages/SplashScreen';
import LoginScreen from './pages/LoginScreen';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import DocumentationModal from './components/DocumentationModal';

// Lazy load route components for code splitting
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Products = lazy(() => import('./pages/Products'));
const Sales = lazy(() => import('./pages/Sales'));
const RestaurantPOS = lazy(() => import('./pages/RestaurantPOS'));
const SalesManagement = lazy(() => import('./pages/SalesManagement'));
const Purchases = lazy(() => import('./pages/Purchases'));
const Customers = lazy(() => import('./pages/Customers'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const Reports = lazy(() => import('./pages/Reports'));
const Admin = lazy(() => import('./pages/Admin'));

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-red-200 border-t-red-600 mb-4"></div>
      <p className="text-gray-600 font-medium">Loading...</p>
    </div>
  </div>
);

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<SplashScreen />} />
        <Route path="/login" element={<LoginScreen />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute blockedRoles={['cashier']}>
              <Layout>
                <Suspense fallback={<PageLoader />}>
                  <Dashboard />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/products"
          element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<PageLoader />}>
                  <Products />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales"
          element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<PageLoader />}>
                  <Sales />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant"
          element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<PageLoader />}>
                  <RestaurantPOS />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales-management"
          element={
            <ProtectedRoute blockedRoles={['cashier']}>
              <Layout>
                <Suspense fallback={<PageLoader />}>
                  <SalesManagement />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/purchases"
          element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<PageLoader />}>
                  <Purchases />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/customers"
          element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<PageLoader />}>
                  <Customers />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/suppliers"
          element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<PageLoader />}>
                  <Suppliers />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<PageLoader />}>
                  <Reports />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<PageLoader />}>
                  <Admin />
                </Suspense>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/sales" replace />} />
      </Routes>
      <DocumentationModal />
    </HashRouter>
  );
}

export default App;

