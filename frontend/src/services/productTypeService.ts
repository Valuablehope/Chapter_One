import api from './api';

export interface ProductType {
  id: string;
  name: string;
  display_on_pos: boolean;
  created_at: string;
  updated_at: string;
}

export const productTypeService = {
  getProductTypes: async (): Promise<{ data: ProductType[] }> => {
    const response = await api.get('/product-types');
    return response.data;
  },

  createProductType: async (data: { name: string; display_on_pos?: boolean }): Promise<ProductType> => {
    const response = await api.post('/product-types', data);
    return response.data;
  },

  updateProductType: async (id: string, data: { name: string; display_on_pos?: boolean }): Promise<ProductType> => {
    const response = await api.put(`/product-types/${id}`, data);
    return response.data;
  },

  deleteProductType: async (id: string): Promise<void> => {
    await api.delete(`/product-types/${id}`);
  },
};
