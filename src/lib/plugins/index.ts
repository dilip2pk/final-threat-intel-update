/**
 * Plugin System — Public API
 * 
 * Import everything from here:
 *   import { pluginRegistry } from "@/lib/plugins";
 */

export { pluginRegistry } from "./registry";
export type {
  PluginMetadata,
  PluginCategory,
  PluginRoute,
  PluginWidget,
  PluginDefinition,
  PluginValidation,
} from "./types";
