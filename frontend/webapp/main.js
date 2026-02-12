import "@ui5/webcomponents-theming/dist/Assets.js";
import "@ui5/webcomponents-theming/dist/generated/themes/sap_horizon.css";

import { setTheme } from "@ui5/webcomponents-base/dist/config/Theme.js";

// SAP Horizon only
setTheme("sap_horizon");

// Content density (enterprise compact)
document.documentElement.setAttribute("data-ui5-compact-size", "");

// --- Web Components used across the app ---
import "@ui5/webcomponents/dist/Button.js";
import "@ui5/webcomponents/dist/Title.js";
import "@ui5/webcomponents/dist/Label.js";
import "@ui5/webcomponents/dist/Input.js";
import "@ui5/webcomponents/dist/TextArea.js";
import "@ui5/webcomponents/dist/Link.js";
import "@ui5/webcomponents/dist/Badge.js";
import "@ui5/webcomponents/dist/BusyIndicator.js";
import "@ui5/webcomponents/dist/MessageStrip.js";
import "@ui5/webcomponents/dist/Toast.js";
import "@ui5/webcomponents/dist/Card.js";
import "@ui5/webcomponents/dist/FlexBox.js";
import "@ui5/webcomponents/dist/FlexBoxJustifyContent.js";
import "@ui5/webcomponents/dist/FlexBoxAlignItems.js";
import "@ui5/webcomponents/dist/Table.js";
import "@ui5/webcomponents/dist/TableColumn.js";
import "@ui5/webcomponents/dist/TableRow.js";
import "@ui5/webcomponents/dist/TableCell.js";
import "@ui5/webcomponents/dist/DatePicker.js";
import "@ui5/webcomponents/dist/Select.js";
import "@ui5/webcomponents/dist/Option.js";
import "@ui5/webcomponents/dist/Panel.js";
import "@ui5/webcomponents/dist/Bar.js";
import "@ui5/webcomponents/dist/Avatar.js";

import "@ui5/webcomponents-icons/dist/bell.js";
import "@ui5/webcomponents-icons/dist/search.js";
import "@ui5/webcomponents-icons/dist/menu2.js";
import "@ui5/webcomponents-icons/dist/add.js";
import "@ui5/webcomponents-icons/dist/upload.js";
import "@ui5/webcomponents-icons/dist/initiative.js";

import "@ui5/webcomponents-fiori/dist/ShellBar.js";
import "@ui5/webcomponents-fiori/dist/ToolPage.js";
import "@ui5/webcomponents-fiori/dist/SideNavigation.js";
import "@ui5/webcomponents-fiori/dist/SideNavigationItem.js";
import "@ui5/webcomponents-fiori/dist/DynamicPage.js";
import "@ui5/webcomponents-fiori/dist/DynamicPageTitle.js";
import "@ui5/webcomponents-fiori/dist/DynamicPageHeader.js";
import "@ui5/webcomponents-fiori/dist/UploadCollection.js";
import "@ui5/webcomponents-fiori/dist/UploadCollectionItem.js";
import "@ui5/webcomponents-fiori/dist/Breadcrumbs.js";
import "@ui5/webcomponents-fiori/dist/BreadcrumbsItem.js";
import "@ui5/webcomponents-fiori/dist/NotificationList.js";
import "@ui5/webcomponents-fiori/dist/NotificationListItem.js";
import "@ui5/webcomponents/dist/Dialog.js";

import { AppShell } from "./layout/AppShell.js";

const root = document.getElementById("app");
if (!root) {
  throw new Error("Missing #app root element");
}

const app = new AppShell();
root.appendChild(app.el);
app.start();
