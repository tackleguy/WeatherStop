// Thin redirect that sets a map product then lands on the radar shell.

import { Navigate } from 'react-router-dom';
import type { ProductId } from '../constants/products';
import { useRadarStore } from '../store/useRadarStore';

interface Props {
  product: ProductId;
  to?: string;
}

export function MapProductRedirect({ product, to = '/radar' }: Props) {
  useRadarStore.getState().setActiveProduct(product);
  return <Navigate to={to} replace />;
}
