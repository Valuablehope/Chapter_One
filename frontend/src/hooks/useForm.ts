import { useState, useCallback, useMemo } from 'react';
import { logger } from '../utils/logger';
import toast from 'react-hot-toast';

export type ValidationRule<T> = (value: T, formData?: any) => string | null;

export interface FormField<T = any> {
  value: T;
  rules?: ValidationRule<T>[];
}

export interface UseFormOptions<T extends Record<string, any>> {
  initialValues: T;
  onSubmit: (values: T) => Promise<void> | void;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
}

/**
 * Generic form hook for managing form state, validation, and submission
 * 
 * @template T - The form data type (object with string keys)
 * @param options - Form configuration options
 * @returns Form state and handlers
 */
export function useForm<T extends Record<string, any>>({
  initialValues,
  onSubmit,
  validateOnChange = false,
  validateOnBlur = true,
}: UseFormOptions<T>) {
  const [formData, setFormData] = useState<T>(initialValues);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);

  /**
   * Validates a single field
   */
  const validateField = useCallback((_name: keyof T, _value: any): string | null => {
    // Field-specific validation can be added here
    // For now, we'll rely on component-level validation
    return null;
  }, []);

  /**
   * Validates all form fields
   */
  const validateForm = useCallback((): boolean => {
    const errors: Record<string, string> = {};
    let isValid = true;

    // Basic validation - check required fields
    Object.keys(formData).forEach((key) => {
      const value = formData[key];
      if (value === null || value === undefined || value === '') {
        // Skip validation for optional fields
        // Components should handle their own validation rules
      }
    });

    setFormErrors(errors);
    return isValid && Object.keys(errors).length === 0;
  }, [formData]);

  /**
   * Handles field value changes
   */
  const handleChange = useCallback((name: keyof T, value: any) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field when user starts typing
    if (formErrors[name as string]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name as string];
        return newErrors;
      });
    }

    // Validate on change if enabled
    if (validateOnChange && touched[name as string]) {
      const error = validateField(name, value);
      if (error) {
        setFormErrors(prev => ({ ...prev, [name as string]: error }));
      }
    }
  }, [formErrors, validateOnChange, touched, validateField]);

  /**
   * Handles field blur events
   */
  const handleBlur = useCallback((name: keyof T) => {
    setTouched(prev => ({ ...prev, [name as string]: true }));
    
    if (validateOnBlur) {
      const error = validateField(name, formData[name]);
      if (error) {
        setFormErrors(prev => ({ ...prev, [name as string]: error }));
      }
    }
  }, [validateOnBlur, validateField, formData]);

  /**
   * Handles form submission
   */
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    // Mark all fields as touched
    const allTouched: Record<string, boolean> = {};
    Object.keys(formData).forEach(key => {
      allTouched[key] = true;
    });
    setTouched(allTouched);

    // Validate form
    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(formData);
    } catch (err: any) {
      const errorMessage = err.response?.data?.error?.message || 'Failed to submit form';
      toast.error(errorMessage);
      logger.error('Form submission error:', err);
      
      // Set form-level errors if provided
      if (err.response?.data?.errors) {
        setFormErrors(err.response.data.errors);
      }
    } finally {
      setSubmitting(false);
    }
  }, [formData, validateForm, onSubmit]);

  /**
   * Resets form to initial values
   */
  const resetForm = useCallback(() => {
    setFormData(initialValues);
    setFormErrors({});
    setTouched({});
    setSubmitting(false);
  }, [initialValues]);

  /**
   * Sets form errors manually
   */
  const setErrors = useCallback((errors: Record<string, string>) => {
    setFormErrors(errors);
  }, []);

  /**
   * Sets a single field error
   */
  const setFieldError = useCallback((name: keyof T, error: string) => {
    setFormErrors(prev => ({ ...prev, [name as string]: error }));
  }, []);

  /**
   * Checks if form is valid
   */
  const isValid = useMemo(() => {
    return Object.keys(formErrors).length === 0;
  }, [formErrors]);

  /**
   * Checks if form has been modified
   */
  const isDirty = useMemo(() => {
    return JSON.stringify(formData) !== JSON.stringify(initialValues);
  }, [formData, initialValues]);

  return {
    formData,
    formErrors,
    touched,
    submitting,
    isValid,
    isDirty,
    handleChange,
    handleBlur,
    handleSubmit,
    resetForm,
    setFormData,
    setErrors,
    setFieldError,
    validateForm,
  };
}

