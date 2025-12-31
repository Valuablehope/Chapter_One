import { Request, Response } from 'express';
import { StockModel } from '../models/StockModel';
import { CustomError, asyncHandler } from '../middleware/errorHandler';
import { SaleModel } from '../models/SaleModel';

// Get stock balance for a specific product
export const getStockBalance = asyncHandler(async (req: Request, res: Response) => {
  const { product_id } = req.params;
  
  if (!product_id) {
    throw new CustomError('Product ID is required', 400);
  }

  // Get default store
  const store = await SaleModel.getDefaultStore();
  if (!store) {
    throw new CustomError('No active store found', 404);
  }

  const stockBalance = await StockModel.getStockBalance(store.store_id, product_id);
  
  res.json({
    success: true,
    data: stockBalance || {
      store_id: store.store_id,
      product_id,
      qty_on_hand: 0,
    },
  });
});

// Get stock balances for multiple products (batch request)
export const getStockBalances = asyncHandler(async (req: Request, res: Response) => {
  const { product_ids } = req.body;
  
  if (!product_ids || !Array.isArray(product_ids) || product_ids.length === 0) {
    throw new CustomError('product_ids array is required', 400);
  }

  // Get default store
  const store = await SaleModel.getDefaultStore();
  if (!store) {
    throw new CustomError('No active store found', 404);
  }

  // Fetch all stock balances for the store and filter by requested product IDs
  const allBalances = await StockModel.getStockBalancesByStore(store.store_id);
  const requestedBalances = product_ids.map((productId: string) => {
    const balance = allBalances.find(b => b.product_id === productId);
    return balance || {
      store_id: store.store_id,
      product_id: productId,
      qty_on_hand: 0,
    };
  });
  
  res.json({
    success: true,
    data: requestedBalances,
  });
});

