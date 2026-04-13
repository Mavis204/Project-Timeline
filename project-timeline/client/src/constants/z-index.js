/**
 * Z-Index Layering System
 *
 * Consistent z-index values for UI elements to ensure proper stacking order.
 * Keep this standardized across the application.
 */

export const Z_INDEX = {
  // Base layer
  base: 1,

  // Header/Navigation (always visible above content)
  header: 10,
  topBar: 10,

  // Dropdowns & Popovers (above most content, below modals)
  dropdown: 3000,
  dropdown_menu: 3000,
  popover: 3000,

  // Modals
  modalOverlay: 4000,
  modal: 4001,

  // Tooltips & High-priority UI (above modals)
  tooltip: 9999,
  toast: 5000,
};

export default Z_INDEX;
