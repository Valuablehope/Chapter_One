export const en = {
  nav: {
    dashboard: "Dashboard",
    products: "Products",
    pos_sales: "POS Sales",
    restaurant: "Restaurant",
    sales: "Sales",
    purchases: "Purchases",
    customers: "Customers",
    suppliers: "Suppliers",
    reports: "Reports",
    admin: "Admin",
    sign_out: "Sign Out",
  },
  admin: {
    title: "Admin Panel",
    subtitle: "Manage users, stores, and terminals",
    tabs: {
      users: "Users",
      stores: "Stores",
      terminals: "Terminals",
      license: "License",
      menus: "Menus",
      settings: "Settings"
    },
    settings: {
      title: "Platform Settings",
      language: "Language",
      english: "English",
      arabic: "Arabic"
    },
    users: {
      search: "Search users...",
      all_roles: "All Roles",
      cashier: "Cashier",
      manager: "Manager",
      admin: "Admin",
      add_user: "+ Add User",
      users_count: "Users",
      filtered_results: "Filtered: {{count}} results",
      no_users: "No users found",
      try_adjusting: "Try adjusting your filters",
      get_started: "Get started by adding your first user",
      username: "Username",
      full_name: "Full Name",
      role: "Role",
      status: "Status",
      actions: "Actions",
      active: "Active",
      inactive: "Inactive",
      edit: "Edit",
      delete: "Delete",
      showing: "Showing",
      to: "to",
      of: "of",
      previous: "Previous",
      next: "Next",
      page: "Page",
      edit_user: "Edit User",
      save_changes: "Save Changes",
      create_user: "Create User",
      cancel: "Cancel",
      fields_required: "Fields marked * are required",
      password: "Password",
      leave_blank_password: "Leave blank to keep current password",
      min_6_chars: "Min 6 characters",
      username_cannot_change: "Username cannot be changed after creation",
      role_cashier_desc: "POS access only",
      role_manager_desc: "Reports & inventory",
      role_admin_desc: "Full access",
      account_active: "Account Active",
      inactive_user_desc: "Inactive users cannot sign in to the POS"
    },
    stores: {
      edit_store: "Edit Store",
      add_store: "Add Store",
      identity: "Identity",
      regional: "Regional",
      pos_receipts: "POS & Receipts",
      inventory: "Inventory",
      settings: "Settings",
      backup: "Backup",
      cancel: "Cancel",
      save_changes: "Save Changes",
      create_store: "Create Store",
      code: "Store Code",
      name: "Store Name",
      address: "Address",
      phone: "Phone",
      status: "Status",
      store_active: "Store Active"
    },
    terminals: {
      search: "Search terminals...",
      all_stores: "All Stores",
      add_terminal: "+ Add Terminal",
      terminals_count: "Terminals",
      filtered_results: "Filtered: {{count}} results",
      no_terminals: "No terminals found",
      try_adjusting: "Try adjusting your filters",
      get_started: "Get started by adding your first terminal",
      terminal_name: "Terminal Name",
      status: "Status",
      edit_terminal: "Edit Terminal",
      create_terminal: "Create Terminal",
      cancel: "Cancel",
      save_changes: "Save Changes",
      terminal_active: "Terminal Active"
    },
    menus: {
      search: "Search menus...",
      add_menu: "+ Add Menu",
      menus_count: "Menus",
      no_menus: "No menus found",
      menu_name: "Menu Name",
      description: "Description",
      status: "Status",
      edit_menu: "Edit Menu",
      create_menu: "Create Menu",
      cancel: "Cancel"
    }
  },
  receipt: {
    receipt_no: "Receipt #",
    po_no: "PO #",
    date: "Date",
    customer: "Customer",
    description: "Description",
    qty: "Qty",
    price: "Price",
    total: "Total",
    subtotal: "Subtotal",
    discount: "Discount",
    tax: "Tax",
    net_total: "Net Total",
    net_total_lbp: "Net Total (LBP)",
    change: "Change",
    payment: "{{method}} payment",
    table: "Table",
    guests: "Guests",
    seated: "Seated",
    bill: "Bill",
    service_fee: "Service fee ({{rate}}%)",
    expected_delivery: "Expected delivery",
    status: "Status",
    supplier: "Supplier",
    thank_you_sale: "Thank you for your business!",
    thank_you_restaurant: "Thank you for dining with us!",
    by_cubiq: "By Cubiq Solutions",
  },
  pos_sales: {
    quick_add: "Quick Add Categories",
    items: "Items",
    find_products: "Find Products",
    barcode_scan: "Barcode Scan",
    scan_placeholder: "Scan barcode and press Enter...",
    or: "or",
    search_by: "Search by name or SKU",
    search_placeholder: "e.g. The Alchemist...",
    in_stock: "In stock",
    searching: "Searching...",
    cart: "Cart",
    item_v: "item",
    items_v: "items",
    unit: "unit",
    units: "units",
    no_items: "No items yet",
    scan_to_add: "Scan a barcode or search to add items",
    each: "each",
    stock: "Stock",
    tax: "Tax",
    customer: "Customer",
    customer_placeholder: "Unnamed Customer",
    add_customer: "Add Customer",
    totals: "Totals",
    subtotal: "Subtotal:",
    subtotal_tax_inc: "Subtotal (tax included in prices):",
    tax_inc_prices: "Tax (included in prices):",
    tax_exc: "Tax:",
    net_merch: "Net merchandise ${{net}} + tax ${{tax}} = ${{gross}}",
    discount_pct: "Discount %:",
    discount_amount: "Discount Amount:",
    total_due: "Total Due",
    process_payment: "Process Payment",
    add_item: "Add Item",
    cancel: "Cancel",
    add_to_cart: "Add to Cart",
    quantity: "Quantity",
    total_price: "Total Price ($)",
    selected_amount: "Selected Amount:",
    select_customer: "Select Customer",
    search_customers: "Search customers...",
    no_customers_found: "No customers found",
    try_different_search: "Try a different search term",
    search_for_customers: "Search for customers",
    start_typing: "Start typing to search",
    process_payment_title: "Process Payment",
    cancel_processing: "Cancel Processing",
    complete_sale: "Complete Sale",
    payment_method: "Payment Method",
    cash: "cash",
    card: "card",
    voucher: "voucher",
    other: "other",
    payment_amount: "Payment Amount",
    grand_total: "Grand Total",
    change_due: "Change Due",
    processing: "Processing...",
    please_wait: "Please wait while we process your sale...",
    print_receipt: "Print Receipt",
    new_sale: "New Sale",
    loading_store: "Loading store settings…",
    load_failed: "Could not load store settings. Check your connection and try again.",
    retry: "Retry",
    exchange_rate_title: "LBP exchange rate",
    exchange_rate_value: "{{amount}} LBP per 1 {{currency}}",
    exchange_rate_not_set: "Not set",
    exchange_rate_hint: "Set the rate in Admin → Store → Regional.",
    lbp_field_hint: "Set LBP exchange rate in Admin → Store → Regional to enable this field"
  },
  dashboard: {
    errors: {
      load_stats: "Failed to load dashboard statistics"
    },
    greetings: {
      morning: "Good morning",
      afternoon: "Good afternoon",
      evening: "Good evening"
    },
    defaults: {
      user_name_fallback: "there"
    },
    welcome: "Welcome to {{brand}}",
    signed_in_as: "Signed in as",
    stats: {
      revenue_title: "Today's Revenue",
      revenue_sub: "View full report ->",
      transactions_title: "Transactions",
      low_stock_title: "Low Stock Items",
      avg_order_value_title: "Avg. Order Value",
      today: "Today",
      low_stock_attention: "Needs attention",
      low_stock_healthy: "Stock is healthy"
    },
    quick_access: {
      title: "Quick Access",
      subtitle: "Jump to any module",
      products_label: "Products",
      products_desc: "Manage your catalogue",
      pos_sale_label: "POS - New Sale",
      pos_sale_desc: "Process a transaction",
      purchases_label: "Purchases",
      purchases_desc: "Purchase orders",
      customers_label: "Customers",
      customers_desc: "Customer accounts",
      suppliers_label: "Suppliers",
      suppliers_desc: "Supplier directory",
      reports_label: "Reports",
      reports_desc: "Analytics and insights"
    },
    performance: {
      title: "Today's Performance",
      revenue: "Revenue",
      transactions: "Transactions",
      avg_order: "Avg. Order"
    },
    inventory: {
      title: "Inventory Status",
      subtitle: "Stock health overview",
      loading: "Loading...",
      all_healthy: "All stock levels healthy",
      no_low_items: "No items below reorder threshold",
      low_items_running: "{{count}} item(s) running low",
      review_inventory: "Review inventory ->",
      stock_health: "Stock Health"
    }
  },
  products: {
    title: "Products",
    subtitle: "Manage your product catalogue and inventory",
    common: {
      empty_value: "-"
    },
    columns: {
      show_hide: "Show/Hide Columns",
      name: "Name",
      sku: "SKU",
      barcode: "Barcode",
      type: "Type",
      unit: "Unit",
      list_price: "List Price",
      sale_price: "Sale Price",
      inventory: "Inventory",
      qty_in: "Qty In",
      qty_out: "Qty Out",
      balance: "Balance",
      actions: "Actions"
    },
    filters: {
      search_placeholder: "Search products by name, SKU, or barcode...",
      type_placeholder: "Filter by type...",
      scan_barcode_placeholder: "Scan barcode...",
      products_count: "{{count}} Products",
      filtered_results: "Filtered: {{count}} results"
    },
    badges: {
      tracked: "Tracked",
      not_tracked: "Not Tracked"
    },
    actions: {
      manage_product_types: "Manage Product Types",
      add_product: "Add Product",
      columns: "Columns",
      refresh: "Refresh",
      edit: "Edit",
      delete_short: "Del",
      cancel: "Cancel",
      update_product: "Update Product",
      create_product: "Create Product"
    },
    empty: {
      title: "No products found",
      filtered_description: "Try adjusting your search or filters",
      default_description: "Get started by adding your first product"
    },
    pagination: {
      showing: "Showing",
      to: "to",
      of: "of",
      products: "products",
      previous: "Previous",
      next: "Next",
      page: "Page"
    },
    modal: {
      edit_title: "Edit Product",
      add_title: "Add New Product"
    },
    form: {
      product_name: "Product Name",
      sku: "SKU",
      sku_helper: "Stock Keeping Unit",
      barcode: "Barcode",
      barcode_helper: "8-13 digits",
      product_type: "Product Type",
      select_type: "Select a type",
      unit_of_measure: "Unit of Measure",
      custom_unit_placeholder: "Enter custom number or unit...",
      unit_helper: "How this product is measured when buying/selling",
      list_price: "List Price ($)",
      margin: "Margin (%)",
      margin_helper: "Profit margin",
      sale_price: "Sale Price ($)",
      tax_rate: "Tax Rate (%)",
      tax_rate_helper: "0-100",
      track_inventory: "Track Inventory",
      track_inventory_helper: "Enable inventory tracking for this product"
    },
    units: {
      each: "each",
      pair: "pair",
      dozen: "dozen",
      pack: "pack",
      box: "box",
      carton: "carton",
      kg: "kg",
      g: "g",
      lb: "lb",
      oz: "oz",
      L: "L",
      mL: "mL",
      m: "m",
      cm: "cm",
      custom_number: "Number (Custom)",
      groups: {
        count: "Count",
        weight: "Weight",
        volume: "Volume",
        length: "Length",
        other: "Other"
      }
    },
    types: {
      modal_title: "Manage Product Types",
      cancel_edit: "Cancel Edit",
      save_changes: "Save Changes",
      create_category: "Create Category",
      pos_visible: "POS Visible",
      edit_type: "Edit Product Type",
      add_new_category: "Add New Category",
      name_label: "Product Type Name",
      name_placeholder: "e.g. ELECTRONICS, GROCERIES",
      display_on_pos: "Display on POS Sales",
      display_on_pos_helper: "Show this category on Quick Add grid"
    },
    validation: {
      name_required: "Product name is required",
      barcode_invalid: "Barcode must be 8-13 digits",
      list_price_positive: "List price must be positive",
      sale_price_positive: "Sale price must be positive",
      tax_rate_range: "Tax rate must be between 0 and 100"
    },
    success: {
      product_created: "Product created successfully",
      product_updated: "Product updated successfully",
      product_deleted: "Product deleted successfully",
      product_type_created: "Product type created successfully",
      product_type_updated: "Product type updated successfully",
      product_type_deleted: "Product type deleted"
    },
    errors: {
      load_products: "Failed to load products",
      timeout: "Request timed out. Please try again.",
      save_product: "Failed to save product",
      delete_product: "Failed to delete product",
      lookup_barcode: "Failed to lookup product by barcode",
      finish_action: "Failed to finish action",
      delete_product_type: "Failed to delete product type"
    },
    confirm: {
      delete_product: "Are you sure you want to delete \"{{name}}\"?",
      delete_type: "Are you sure you want to delete this product type?"
    }
  },
  sales_management: {
    title: "Sales Management",
    subtitle: "View and manage all sales invoices",
    common: {
      not_available: "N/A",
      walk_in: "Walk-in"
    },
    filters: {
      title: "Filters",
      search_label: "Search",
      search_placeholder: "Receipt No, Customer, Cashier...",
      status_label: "Status",
      all_status: "All Status",
      start_date: "Start Date",
      end_date: "End Date",
      customer: "Customer",
      search_customer_placeholder: "Search customer..."
    },
    table: {
      receipt_no: "Receipt No",
      date: "Date",
      customer: "Customer",
      items: "Items",
      total: "Total",
      payment: "Payment",
      status: "Status",
      actions: "Actions",
      items_count: "{{count}} item(s)"
    },
    status: {
      paid: "Paid",
      cancelled: "Cancelled",
      void: "Void",
      open: "Open"
    },
    payment: {
      cash: "Cash",
      card: "Card",
      voucher: "Voucher",
      other: "Other"
    },
    actions: {
      view: "View",
      edit: "Edit",
      cancel: "Cancel",
      delete: "Delete",
      close: "Close",
      back: "Back",
      print: "Print",
      print_preview: "Print Preview",
      save_changes: "Save Changes",
      add_payment: "Add Payment"
    },
    empty: {
      title: "No sales found",
      description: "There are no sales invoices matching your filters."
    },
    pagination: {
      showing: "Showing",
      to: "to",
      of: "of",
      sales: "sales",
      previous: "Previous",
      next: "Next",
      page: "Page"
    },
    details: {
      title: "Sale Invoice: {{receiptNo}}",
      phone: "Phone",
      cashier: "Cashier",
      product_id_fallback: "Product ID: {{id}}..."
    },
    edit: {
      title: "Edit Sale: {{receiptNo}}",
      product: "Product",
      qty: "Qty",
      price: "Price",
      total: "Total",
      payments: "Payments",
      amount_placeholder: "Amount",
      search_products_placeholder: "Search products to add..."
    },
    totals: {
      subtotal: "Subtotal:",
      tax: "Tax:",
      discount: "Discount:",
      discount_pct: "Discount %:",
      discount_with_rate: "Discount ({{rate}}%):",
      grand_total: "Grand Total:",
      paid: "Paid:"
    },
    modals: {
      cancel_invoice_title: "Cancel Invoice",
      delete_invoice_title: "Delete Invoice",
      no_keep: "No, Keep",
      yes_cancel_invoice: "Yes, Cancel Invoice",
      yes_delete_permanently: "Yes, Delete Permanently",
      cancel_invoice_question: "Cancel Invoice #{{receiptNo}}?",
      delete_invoice_question: "Permanently Delete Invoice #{{receiptNo}}?",
      cancel_invoice_description: "Are you sure you want to cancel this invoice? This will reverse the stock movements and remove it from active financial reports. This action cannot be reversed.",
      delete_invoice_description: "This will permanently remove this invoice and all its records from the database. Unlike cancellation, this action cannot be undone and will not reverse inventory."
    },
    print: {
      preview_title: "Print Preview: {{receiptNo}}"
    },
    success: {
      sale_updated: "Sale updated successfully",
      sale_cancelled: "Sale invoice cancelled successfully",
      sale_deleted: "Sale invoice permanently deleted"
    },
    errors: {
      load_sales: "Failed to load sales",
      load_sale_details: "Failed to load sale details",
      load_sale_edit: "Failed to load sale for editing",
      update_sale: "Failed to update sale",
      cancel_sale: "Failed to cancel sale",
      delete_sale: "Failed to delete sale",
      timeout: "Request timed out. Please try again.",
      payment_insufficient: "Payment amount must be at least equal to grand total",
      payment_less_than_total: "Payment amount is less than grand total",
      sale_needs_item: "Sale must have at least one item",
      sale_needs_payment: "Sale must have at least one payment"
    }
  },
  customers: {
    title: "Customers",
    subtitle: "Manage your customer database and relationships",
    common: {
      this_customer: "this customer",
      not_available: "N/A",
      empty_value: "-"
    },
    table: {
      name: "Name",
      contact: "Contact",
      email: "Email",
      created: "Created",
      actions: "Actions"
    },
    filters: {
      search_placeholder: "Search by name, phone, or email...",
      customers_count: "{{count}} Customers",
      filtered_results: "Filtered: {{count}} results"
    },
    empty: {
      title: "No customers found",
      filtered_description: "Try adjusting your search",
      default_description: "Get started by adding your first customer"
    },
    pagination: {
      showing: "Showing",
      to: "to",
      of: "of",
      customers: "customers",
      previous: "Previous",
      next: "Next",
      page: "Page"
    },
    actions: {
      add_customer: "Add Customer",
      refresh: "Refresh",
      cancel: "Cancel",
      create: "Create",
      update: "Update",
      edit: "Edit",
      delete: "Delete"
    },
    modal: {
      edit_title: "Edit Customer",
      add_title: "Add Customer"
    },
    form: {
      full_name: "Full Name",
      full_name_placeholder: "Enter full name",
      phone: "Phone",
      phone_placeholder: "Enter phone number",
      email: "Email",
      email_placeholder: "Enter email address",
      notes: "Notes",
      notes_placeholder: "Additional notes about this customer..."
    },
    validation: {
      full_name_required: "Full name is required",
      email_invalid: "Invalid email format"
    },
    success: {
      customer_created: "Customer created successfully",
      customer_updated: "Customer updated successfully",
      customer_deleted: "Customer deleted successfully"
    },
    errors: {
      load_customers: "Failed to load customers",
      timeout: "Request timed out. Please try again.",
      save_customer: "Failed to save customer",
      delete_customer: "Failed to delete customer"
    },
    confirm: {
      delete_customer: "Are you sure you want to delete {{name}}?"
    }
  },
  suppliers: {
    title: "Suppliers",
    subtitle: "Manage your supplier database and relationships",
    common: {
      empty_value: "-"
    },
    table: {
      name: "Name",
      contact_person: "Contact Person",
      phone: "Phone",
      email: "Email",
      created: "Created",
      actions: "Actions"
    },
    filters: {
      search_placeholder: "Search by name, contact person, phone, or email...",
      suppliers_count: "{{count}} Suppliers",
      filtered_results: "Filtered: {{count}} results"
    },
    empty: {
      title: "No suppliers found",
      filtered_description: "Try adjusting your search",
      default_description: "Get started by adding your first supplier"
    },
    pagination: {
      showing: "Showing",
      to: "to",
      of: "of",
      suppliers: "suppliers",
      previous: "Previous",
      next: "Next",
      page: "Page"
    },
    actions: {
      add_supplier: "Add Supplier",
      refresh: "Refresh",
      cancel: "Cancel",
      create: "Create",
      update: "Update",
      edit: "Edit",
      delete: "Delete"
    },
    modal: {
      edit_title: "Edit Supplier",
      add_title: "Add Supplier"
    },
    form: {
      supplier_name: "Supplier Name",
      supplier_name_placeholder: "Enter supplier name",
      contact_person: "Contact Person",
      contact_person_placeholder: "Enter contact person name",
      phone: "Phone",
      phone_placeholder: "Enter phone number",
      email: "Email",
      email_placeholder: "Enter email address"
    },
    validation: {
      name_required: "Supplier name is required",
      email_invalid: "Invalid email format"
    },
    success: {
      supplier_created: "Supplier created successfully",
      supplier_updated: "Supplier updated successfully",
      supplier_deleted: "Supplier deleted successfully"
    },
    errors: {
      load_suppliers: "Failed to load suppliers",
      timeout: "Request timed out. Please try again.",
      save_supplier: "Failed to save supplier",
      delete_supplier: "Failed to delete supplier"
    },
    confirm: {
      delete_supplier: "Are you sure you want to delete {{name}}?"
    }
  },
  purchases: {
    title: "Purchase Orders",
    subtitle: "Manage your inventory purchases and suppliers",
    common: {
      each: "each",
      unknown: "Unknown",
      not_available: "N/A",
      deleted_product: "[Deleted Product - ID: {{id}}...]"
    },
    status: {
      open: "Open",
      pending: "Pending",
      received: "Received",
      cancelled: "Cancelled"
    },
    actions: {
      new_order: "New Purchase Order",
      refresh: "Refresh",
      receive: "Receive",
      view: "View",
      delete: "Delete",
      print_preview: "Print Preview",
      print: "Print",
      back: "Back",
      close: "Close",
      cancel: "Cancel",
      save_changes: "Save Changes",
      create_order: "Create Purchase Order",
      change: "Change",
      select_supplier: "Select Supplier"
    },
    filters: {
      search_placeholder: "Search by PO number or supplier...",
      all_statuses: "All Statuses",
      orders_count: "{{count}} Orders",
      filtered_results: "Filtered: {{count}} results"
    },
    table: {
      po_number: "PO Number",
      supplier: "Supplier",
      status: "Status",
      items: "Items",
      total_cost: "Total Cost",
      ordered_at: "Ordered At",
      actions: "Actions",
      items_count: "{{count}} item(s)"
    },
    pagination: {
      showing: "Showing",
      to: "to",
      of: "of",
      orders: "purchase orders",
      previous: "Previous",
      next: "Next",
      page: "Page"
    },
    empty: {
      title: "No purchase orders found",
      filtered_description: "Try adjusting your search or filters",
      default_description: "Get started by creating your first purchase order"
    },
    modal: {
      print_preview_title: "Print Preview: {{poNumber}}",
      view_title: "View Purchase Order",
      new_title: "New Purchase Order"
    },
    form: {
      supplier: "Supplier",
      expected_delivery_optional: "Expected Delivery Date (Optional)",
      items: "Items",
      scan_barcode_placeholder: "Scan barcode...",
      search_products_placeholder: "Search products...",
      no_items_title: "No items added",
      no_items_description: "Search and add products to get started",
      product: "Product",
      quantity: "Quantity",
      unit_cost: "Unit Cost",
      total: "Total",
      total_label: "Total:"
    },
    supplier_modal: {
      title: "Select Supplier",
      search_placeholder: "Search suppliers...",
      no_suppliers_title: "No suppliers found",
      no_suppliers_description: "Try a different search term",
      search_title: "Search for suppliers",
      search_description: "Start typing to search"
    },
    success: {
      order_created: "Purchase order created successfully",
      order_updated: "Purchase order updated successfully",
      order_received: "Purchase order received successfully",
      order_deleted: "Purchase order deleted successfully"
    },
    errors: {
      load_orders: "Failed to load purchase orders",
      search_suppliers: "Failed to search suppliers",
      search_products: "Failed to search products",
      barcode_not_found: "Product with barcode {{barcode}} not found",
      lookup_barcode: "Failed to lookup product by barcode",
      load_order_details: "Failed to load purchase order details",
      select_supplier: "Please select a supplier",
      add_one_item: "Please add at least one item",
      only_open_editable: "Only OPEN purchase orders can be edited",
      timeout: "Request timed out. Please try again.",
      save_order: "Failed to save purchase order",
      receive_order: "Failed to receive purchase order",
      delete_order: "Failed to delete purchase order"
    },
    confirm: {
      receive_order: "Receive purchase order {{poNumber}}? This will update stock levels.",
      delete_order: "Are you sure you want to delete purchase order {{poNumber}}?"
    }
  },
  reports: {
    title: "Reports & Analytics",
    subtitle: "View sales, purchases, and inventory insights",
    actions: {
      refresh: "Refresh"
    },
    tabs: {
      sales: "Sales Reports",
      purchases: "Purchase Reports",
      inventory: "Inventory Reports"
    },
    presets: {
      week: "Last Week",
      month: "Last Month",
      quarter: "Last Quarter",
      custom: "Custom Dates"
    },
    common: {
      range_arrow: "->",
      unknown: "Unknown",
      not_available: "N/A",
      yes: "Yes",
      no: "No"
    },
    empty: {
      no_data_title: "No data available"
    },
    sales: {
      cards: {
        total_revenue: "Total Revenue",
        transactions: "Transactions",
        avg_order_value: "Avg. Order Value",
        vs_prior_half: "vs prior half of period"
      },
      types: {
        summary: "Summary",
        by_product: "By Product",
        by_customer: "By Customer",
        payment_methods: "Payment Methods"
      },
      summary: {
        revenue_trend: "Revenue Trend",
        date: "Date",
        transactions: "Transactions",
        revenue: "Revenue",
        tax: "Tax",
        no_data_description: "No sales data found for the selected date range"
      },
      products: {
        top_products_by_revenue: "Top Products by Revenue",
        product: "Product",
        quantity_sold: "Quantity Sold",
        sales_count: "Sales Count",
        no_data_description: "No product sales data found for the selected date range"
      },
      customers: {
        customer: "Customer",
        orders: "Orders",
        total_spent: "Total Spent",
        last_order: "Last Order",
        no_data_description: "No customer sales data found for the selected date range"
      },
      payments: {
        distribution: "Payment Methods Distribution",
        method: "Payment Method",
        total_amount: "Total Amount",
        no_data_description: "No payment method data found for the selected date range"
      }
    },
    purchases: {
      cards: {
        total_cost: "Total Cost",
        purchase_orders: "Purchase Orders"
      },
      types: {
        summary: "Summary",
        by_supplier: "By Supplier"
      },
      summary: {
        cost_trend: "Purchase Cost Trend",
        date: "Date",
        purchase_orders: "Purchase Orders",
        total_cost: "Total Cost",
        no_data_description: "No purchase data found for the selected date range"
      },
      suppliers: {
        supplier: "Supplier",
        orders: "Orders",
        last_order: "Last Order",
        no_data_description: "No supplier purchase data found for the selected date range"
      }
    },
    inventory: {
      types: {
        stock_levels: "Stock Levels",
        low_stock: "Low Stock"
      },
      stock: {
        product: "Product",
        quantity_on_hand: "Quantity on Hand",
        track_inventory: "Track Inventory",
        no_data_description: "No stock data found"
      },
      low_stock: {
        restock_notice: "{{count}} item(s) need restocking",
        threshold: "Threshold",
        status: "Status",
        all_good_title: "All items are well stocked",
        all_good_description: "No low stock items found",
        badge: "Low Stock"
      }
    },
    errors: {
      load_report: "Failed to load report"
    }
  }
};
