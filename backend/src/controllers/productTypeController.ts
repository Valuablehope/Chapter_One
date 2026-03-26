import { Request, Response } from 'express';
import { ProductTypeModel } from '../models/ProductTypeModel';

export const getProductTypes = async (_req: Request, res: Response) => {
  try {
    const productTypes = await ProductTypeModel.findAll();
    res.json({ data: productTypes });
  } catch (error) {
    res.status(500).json({ error: { message: 'Failed to fetch product types' } });
  }
};

export const createProductType = async (req: Request, res: Response) => {
  try {
    const { name, display_on_pos } = req.body;
    if (!name) {
      return res.status(400).json({ error: { message: 'Name is required' } });
    }

    const existing = await ProductTypeModel.findByName(name.toUpperCase());
    if (existing) {
      return res.status(400).json({ error: { message: 'Product type already exists' } });
    }

    const productType = await ProductTypeModel.create(name, display_on_pos || false);
    res.status(201).json(productType);
  } catch (error) {
    res.status(500).json({ error: { message: 'Failed to create product type' } });
  }
};

export const updateProductType = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, display_on_pos } = req.body;
    if (!name) {
      return res.status(400).json({ error: { message: 'Name is required' } });
    }

    const existingName = await ProductTypeModel.findByName(name.toUpperCase());
    if (existingName && existingName.id !== id) {
      return res.status(400).json({ error: { message: 'Product type name already exists' } });
    }

    const updated = await ProductTypeModel.update(id, name, display_on_pos ?? false);
    if (!updated) {
      return res.status(404).json({ error: { message: 'Product type not found' } });
    }
    
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: { message: 'Failed to update product type' } });
  }
};

export const deleteProductType = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = await ProductTypeModel.delete(id);
    if (!success) {
      return res.status(404).json({ error: { message: 'Product type not found' } });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: { message: 'Failed to delete product type' } });
  }
};
