import { Request, Response } from 'express';
import { ReportModel, ReportFilters } from '../models/ReportModel';
import { CustomError, asyncHandler } from '../middleware/errorHandler';

export const getSalesSummary = asyncHandler(async (req: Request, res: Response) => {
  const filters: ReportFilters = {
    start_date: req.query.start_date as string,
    end_date: req.query.end_date as string,
    store_id: req.query.store_id as string,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
  };

  const result = await ReportModel.getSalesSummary(filters);
  res.json({
    success: true,
    data: result,
  });
});

export const getProductSales = asyncHandler(async (req: Request, res: Response) => {
  const filters: ReportFilters = {
    start_date: req.query.start_date as string,
    end_date: req.query.end_date as string,
    store_id: req.query.store_id as string,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
  };

  const result = await ReportModel.getProductSales(filters);
  res.json({
    success: true,
    data: result,
  });
});

export const getCustomerSales = asyncHandler(async (req: Request, res: Response) => {
  const filters: ReportFilters = {
    start_date: req.query.start_date as string,
    end_date: req.query.end_date as string,
    store_id: req.query.store_id as string,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
  };

  const result = await ReportModel.getCustomerSales(filters);
  res.json({
    success: true,
    data: result,
  });
});

export const getPaymentMethodReport = asyncHandler(async (req: Request, res: Response) => {
  const filters: ReportFilters = {
    start_date: req.query.start_date as string,
    end_date: req.query.end_date as string,
    store_id: req.query.store_id as string,
  };

  const result = await ReportModel.getPaymentMethodReport(filters);
  res.json({
    success: true,
    data: result,
  });
});

export const getPurchaseSummary = asyncHandler(async (req: Request, res: Response) => {
  const filters: ReportFilters = {
    start_date: req.query.start_date as string,
    end_date: req.query.end_date as string,
    store_id: req.query.store_id as string,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
  };

  const result = await ReportModel.getPurchaseSummary(filters);
  res.json({
    success: true,
    data: result,
  });
});

export const getSupplierPurchases = asyncHandler(async (req: Request, res: Response) => {
  const filters: ReportFilters = {
    start_date: req.query.start_date as string,
    end_date: req.query.end_date as string,
    store_id: req.query.store_id as string,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
  };

  const result = await ReportModel.getSupplierPurchases(filters);
  res.json({
    success: true,
    data: result,
  });
});

export const getStockReport = asyncHandler(async (req: Request, res: Response) => {
  const storeId = req.query.store_id as string | undefined;
  const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
  const result = await ReportModel.getStockReport(storeId, page, limit);
  res.json({
    success: true,
    data: result.data,
    pagination: result.pagination,
  });
});

export const getLowStockReport = asyncHandler(async (req: Request, res: Response) => {
  const storeId = req.query.store_id as string | undefined;
  const threshold = req.query.threshold ? parseInt(req.query.threshold as string, 10) : 10;
  const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
  const result = await ReportModel.getLowStockReport(storeId, threshold, page, limit);
  res.json({
    success: true,
    data: result.data,
    pagination: result.pagination,
  });
});

export const getProfitReport = asyncHandler(async (req: Request, res: Response) => {
  const filters: ReportFilters = {
    start_date: req.query.start_date as string,
    end_date: req.query.end_date as string,
    store_id: req.query.store_id as string,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
  };

  const result = await ReportModel.getProfitReport(filters);
  res.json({
    success: true,
    data: result,
  });
});











