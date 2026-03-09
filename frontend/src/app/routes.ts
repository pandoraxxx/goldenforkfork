import { createBrowserRouter } from 'react-router';
import { Root } from './pages/Root';
import { Home } from './pages/Home';
import { Favorites } from './pages/Favorites';
import { StockDetail } from './pages/StockDetail';
import { Subscriptions } from './pages/Subscriptions';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Root,
    children: [
      {
        index: true,
        Component: Home,
      },
      {
        path: 'favorites',
        Component: Favorites,
      },
      {
        path: 'stock/:code',
        Component: StockDetail,
      },
      {
        path: 'subscriptions',
        Component: Subscriptions,
      },
    ],
  },
]);
