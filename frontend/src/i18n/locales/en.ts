export const en = {
  nav: {
    dashboard: "Dashboard",
    products: "Products",
    pos_sales: "POS Sales",
    restaurant: "Restaurant",
    sales: "Sales",
    purchases: "Purchases",
    opening_stock: "Opening Stock",
    expenses: "Expenses",
    customers: "Customers",
    suppliers: "Suppliers",
    reports: "Reports",
    admin: "Admin",
    day_closure: "Day Closure",
    dispose: "Dispose Items",
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
      settings: "Settings",
      scales: "Scales"
    },
    settings: {
      title: "Platform Settings",
      language: "Language",
      english: "English",
      arabic: "Arabic"
    },
    scales: {
      loading: "Loading...",
      cancel: "Cancel",
      save: "Save",
      load_failed: "Failed to load scale settings",
      save_failed: "Failed to save",
      devices_title: "Scale Devices",
      devices_hint: "{{count}} product(s) currently carry a PLU code and will be sent to the scales on sync.",
      no_devices: "No scales registered",
      no_devices_desc: "Add your LAN label scale to push product PLUs (name + price) to it. Scanned labels work even without a registered device — configure the barcode formats below.",
      add_device: "Add Scale",
      edit_device: "Edit Scale",
      device_created: "Scale added",
      device_updated: "Scale updated",
      device_deleted: "Scale deleted",
      confirm_delete_device: "Delete this scale device?",
      name_required: "Scale name is required",
      host_port_required: "IP address and port are required for TCP sync",
      test: "Test",
      sync: "Sync",
      test_failed: "Connection test failed",
      sync_failed: "Sync failed",
      export_csv: "Export PLU CSV",
      export_failed: "Export failed",
      col_name: "Name",
      col_brand: "Brand",
      col_connection: "Connection",
      col_last_sync: "Last Sync",
      col_status: "Status",
      col_layout: "Layout",
      col_value: "Encodes",
      active: "Active",
      inactive: "Inactive",
      device_name: "Scale Name",
      brand: "Brand / Model",
      driver: "Sync Method",
      driver_tcp: "Network push (TCP)",
      driver_csv: "CSV file (vendor tool)",
      host: "IP Address",
      port: "Port",
      department: "Department",
      record_template: "Record Template",
      csv_header: "CSV Header Row",
      formats_title: "Label Barcode Formats",
      formats_hint: "How the barcodes printed by your scales are decoded at the register. P = PLU digits, V = price, W = weight, Q = quantity, C = check digit. Exact product barcodes always take priority over these formats.",
      add_format: "Add Format",
      edit_format: "Edit Format",
      format_created: "Format added",
      format_updated: "Format updated",
      format_deleted: "Format deleted",
      confirm_delete_format: "Delete this barcode format?",
      format_fields_required: "Name and prefixes are required",
      format_name: "Format Name",
      prefixes: "Accepted Prefixes",
      check_digit: "Check Digit",
      none: "None",
      plu_length: "PLU Digits",
      value_length: "Value Digits",
      value_type: "Value Encodes",
      value_divisor: "Divisor",
      value_type_price: "Price",
      value_type_weight: "Weight",
      value_type_quantity: "Quantity",
      value_type_none: "Nothing",
      layout_preview: "Layout",
      priority: "Priority",
      test_label_title: "Test a label — scan it here",
      test_label_placeholder: "Scan or type a label barcode...",
      decode: "Decode",
      test_no_match: "No active format matched this barcode ({{count}} active format(s))",
      test_no_product: "Decoded, but no product carries this PLU code",
      qty: "Qty",
      total: "Total"
    },
    users: {
      search: "Search users...",
      all_roles: "All Roles",
      cashier: "Cashier",
      manager: "Manager",
      admin: "Admin",
      self_checkout: "Self-Checkout",
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
      role_self_checkout_desc: "Self-checkout POS only",
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
      store_active: "Store Active",
      ui_resolution: "UI Resolution",
      ui_resolution_helper: "Forces the interface to a specific scaling",
      receipt_printer: 'Receipt Printer',
      receipt_printer_helper: 'Select the specific printer for silent receipts. Leave as Default System Printer to use your computer\'s default printer.',
      round_lbp_to_1000: "Round LBP to nearest 1,000",
      round_lbp_hint: "E.g., 125,200 becomes 126,000"
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
    invoice_no: "Invoice #",
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
    notes: "Notes",
    phone: "Phone",
    address: "Address",
    order_type: "Order",
    expected_delivery: "Expected delivery",
    status: "Status",
    supplier: "Supplier",
    thank_you_sale: "Thank you for your business!",
    thank_you_restaurant: "Thank you for dining with us!",
    by_cubiq: "By Cubiq Solutions",
    delivery: "Delivery",
    not_in_drawer: "not in drawer",
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
    clear: "Clear",
    clear_cart: "Clear Cart",
    confirm_clear_cart: "Are you sure you want to clear the active cart?",
    close: "Close",
    done: "Done",
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
    cash: "Cash",
    card: "Card",
    voucher: "Voucher",
    other: "Refund",
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
    lbp_field_hint: "Set LBP exchange rate in Admin → Store → Regional to enable this field",
    no_items_category: "There are no Products in this category yet!",
    try_another_category: "Try selecting a different category"
  },
  restaurant_pos: {
    loading: "Loading restaurant...",
    load_failed: "Failed to load store settings",
    menu_load_failed: "Failed to load menus from Admin. Please try again.",
    no_menus: "No menus configured. Go to Admin → Menus to add menus.",
    available: "Available",
    occupied: "Occupied",
    bill_requested_short: "Bill Req.",
    bill_requested: "Bill Requested",
    bill_out: "Bill Out",
    table: "Table",
    tables: "Tables",
    guest_v: "guest",
    guests_v: "guests",
    item_v: "item",
    items_v: "items",
    menu: "Menu",
    order: "Order",
    search_placeholder: "Search items across all menus…",
    search_results: "{{count}} result(s) for \"{{query}}\"",
    items_in_category: "{{count}} items",
    no_search_results: "No items found for \"{{query}}\"",
    try_different: "Try a different search term",
    no_items_in_category: "No items in this category",
    order_empty: "Order is empty",
    tap_to_add: "Tap items from the menu to add them",
    service_fee: "Service Fee",
    service_fee_on_subtotal: "+{{rate}}% on subtotal",
    order_notes: "Order Notes",
    order_notes_placeholder: "Add a note for this order (allergies, requests…)",
    subtotal: "Subtotal",
    tax_with_rate: "Tax ({{rate}}%)",
    total: "Total",
    print_bill: "Print Bill",
    reprint_bill: "Reprint Bill",
    checkout: "Checkout",
    cancel_order: "Cancel Order",
    cancel_order_title: "Cancel Order — {{label}}",
    cancel_order_message: "This clears all items and closes the order without charging anything. This cannot be undone.",
    keep_order: "Keep Order",
    seat_guests_title: "Seat Guests — Table {{table}}",
    edit_guests_title: "Edit Guests — Table {{table}}",
    how_many_guests: "How many guests?",
    seat_guests_cta: "Seat {{count}} Guest(s)",
    update_guests_cta: "Update Guest Count",
    checkout_title: "Checkout — {{label}}",
    payment_method: "Payment Method",
    cash: "Cash",
    card: "Card",
    other: "Other",
    amount_given: "Amount Given",
    change_due: "Change Due",
    cancel: "Cancel",
    complete_checkout: "Complete & Checkout",
    processing: "Processing...",
    checkout_complete: "Checkout Complete!",
    print_receipt: "Print Receipt",
    close: "Close",
    walk_in: "Walk-in",
    delivery: "Delivery",
    takeaway_delivery: "Walk-in & Delivery",
    new_walkin: "New Walk-in",
    new_delivery: "New Delivery",
    new_walkin_title: "New Walk-in Order",
    new_delivery_title: "New Delivery Order",
    edit_customer_title: "Edit Customer Details",
    customer_name: "Customer Name",
    customer_name_placeholder: "Search existing customers or type a name",
    linked_customer: "Linked to an existing customer",
    optional: "optional",
    customer_phone: "Phone",
    delivery_address: "Delivery Address",
    delivery_fee: "Delivery Fee",
    start_order: "Start Order",
    save_details: "Save Details",
    delivery_details_required: "Please enter the customer's name and delivery address.",
    no_active_orders: "No active walk-in or delivery orders"
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
  day_closure: {
    title: "Day closure (Z report)",
    subtitle: "Close the current period and lock included sales",
    banner: "Only paid sales not yet assigned to a closure are included. After closing, those sales cannot be edited or voided.",
    loading: "Loading preview…",
    refresh: "Refresh",
    store: "Store",
    total_sales: "Total sales",
    transactions: "Transactions",
    gross_cash: "Cash from sales",
    refund_payouts: "Refund payouts",
    cash_expected: "Expected cash in drawer",
    card: "Card",
    voucher: "Voucher",
    other_payments: "Other payments",
    other_excl_voucher: "Other (excl. voucher)",
    cash_actual_label: "Cash counted (actual)",
    difference: "Difference (actual − expected)",
    balanced: "Balanced",
    short: "Short",
    over: "Over",
    close_day: "Close day",
    confirm_title: "Confirm day closure",
    confirm_body: "This will assign all unclosed paid sales to the next Z report and lock them from further changes. This cannot be undone.",
    confirm_cancel: "Cancel",
    confirm_submit: "Close and lock",
    empty_title: "Nothing to close",
    empty_body: "There are no paid, unclosed sales for this store.",
    success_title: "Day closed",
    z_number: "Z number",
    closed_at: "Closed at",
    cash_difference: "Cash difference",
    print: "Print Z report",
    new_closure: "Done",
    notes_label: "Notes (optional)",
    total_expenses: "Total expenses",
    net_cash_after_expenses: "Net cash (after expenses)",
    opening_float: "Opening float",
    opening_float_carried: "Carried from Z-{{z}} · closed {{date}}",
    opening_float_none: "No previous closure — starting fresh",
    opening_float_adjust: "Adjust opening float",
    opening_float_reset: "Reset to carried amount",
    leave_float_question: "Leave cash in the drawer for tomorrow?",
    leave_float_hint: "This amount stays in the drawer as the next closure's opening float instead of being deposited.",
    yes: "Yes",
    no: "No",
    use_same_float: "Use same as opening ({{amount}})",
    cash_left_in_drawer_label: "Cash left in drawer",
    cash_to_bank: "Amount to bank/deposit",
    errors: {
      load_preview: "Could not load closure preview",
      close_failed: "Could not complete day closure",
      invalid_cash: "Enter a valid cash amount (0 or greater).",
      float_exceeds_cash: "Cash left in drawer cannot exceed the cash counted."
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
      create_product: "Create Product",
      add_image: "Add Image",
      uploading: "Uploading..."
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
      barcode_helper: "Any length or format",
      plu_code: "PLU Code (scale)",
      plu_helper: "Numeric code for label scales — embedded in the printed label barcode",
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
      track_inventory_helper: "Enable inventory tracking for this product",
      product_image: "Product Image",
      image_helper: "Recommended: Square image (800x800px)",
      image_specs: "Max size: 5MB. Formats: JPG, PNG, WEBP."
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
      display_on_pos_helper: "Show this category on Quick Add grid",
      sync_missing: "Sync Missing"
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
      product_type_deleted: "Product type deleted",
      image_uploaded: "Image uploaded successfully",
      types_synced: "Synced {{count}} missing types"
    },
    errors: {
      load_products: "Failed to load products",
      timeout: "Request timed out. Please try again.",
      save_product: "Failed to save product",
      delete_product: "Failed to delete product",
      lookup_barcode: "Failed to lookup product by barcode",
      finish_action: "Failed to finish action",
      delete_product_type: "Failed to delete product type",
      upload_failed: "Failed to upload image",
      image_too_large: "Image is too large (max 5MB)"
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
      invoice_no: "Inv. No",
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
      invoice_no: "Purchase Invoice Number (Optional)",
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
    subtitle: "View sales, purchases, profit, and inventory insights",
    actions: {
      refresh: "Refresh"
    },
    tabs: {
      sales: "Sales Reports",
      purchases: "Purchase Reports",
      profit: "Profit Report",
      inventory: "Inventory Reports"
    },
    profit: {
      total_sales: "Total sales",
      total_cogs: "Cost of goods sold",
      total_profit: "Total profit",
      disclaimer:
        "COGS uses each line quantity multiplied by the product catalog list price (cost base) at report time—not historical cost per sale line."
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
      no: "No",
      showing_page: "Page {{current}} of {{total}}",
      prev: "Prev",
      next: "Next"
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
        no_data_description: "No stock data found",
        search_placeholder: "Search products by name..."
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
