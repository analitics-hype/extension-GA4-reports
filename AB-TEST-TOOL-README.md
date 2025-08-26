# A/B Test Cookie Management Tool

This extension now includes a new A/B testing tool that works on **all websites** (not just Google Analytics). The tool automatically detects and manages A/B test cookies that follow the GTM (Google Tag Manager) pattern.

## How it Works

### Cookie Detection
The tool automatically looks for cookies that start with `_gtm_exp` pattern:
- **Cookie Name Pattern**: `_gtm_exp_AS287` (where AS287 is the test ID)
- **Cookie Value Pattern**: `gtm_ab_AS287_control` (where control/var1/var2/var3 is the variation)

### User Interface
When A/B test cookies are detected, a green floating button with "AB" text appears in the bottom-right corner of any website.

### Features
1. **Automatic Detection**: Automatically scans for A/B test cookies on page load
2. **Multi-Test Management**: Manages multiple A/B tests simultaneously
3. **Easy Switching**: Dropdown interface to switch between variations:
   - Control
   - Variant 1 (var1)
   - Variant 2 (var2)  
   - Variant 3 (var3)
4. **Real-time Updates**: Shows current variation for each test
5. **Apply Changes**: Updates cookies and reloads page to apply new variations
6. **Refresh Tool**: Rescans for new A/B test cookies

## How to Use

1. **Visit any website** with GTM A/B tests
2. **Look for the green "AB" button** in the bottom-right corner
3. **Click the button** to open the management panel
4. **Select different variations** from the dropdowns
5. **Click "Apply Changes"** to update cookies and reload the page
6. **Click "Refresh"** to rescan for new tests

## Testing the Tool

To test this feature, you can manually create test cookies in your browser's console:

```javascript
// Create test A/B test cookies
document.cookie = "_gtm_exp_AS287=gtm_ab_AS287_control; path=/";
document.cookie = "_gtm_exp_BS123=gtm_ab_BS123_var1; path=/";
document.cookie = "_gtm_exp_CS456=gtm_ab_CS456_var2; path=/";

// Refresh the page to see the tool appear
window.location.reload();
```

## Technical Details

### Cookie Structure
- **Key**: `_gtm_exp_{TEST_ID}` (e.g., `_gtm_exp_AS287`)
- **Value**: `gtm_ab_{TEST_ID}_{VARIATION}` (e.g., `gtm_ab_AS287_control`)

### Supported Variations
- `control` - Control group
- `var1` - Variant 1
- `var2` - Variant 2
- `var3` - Variant 3

### File Locations
- **Main Module**: `src/content/modules/ab-test-tool.js`
- **Integration**: `src/content/content.js`

The tool runs independently of the main Google Analytics functionality and works on all websites.
