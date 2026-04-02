/**
 * Plugin Registry
 * 
 * Central registry for all plugins. Validates, registers, and provides
 * access to plugin metadata, routes, and widgets.
 * 
 * Usage:
 *   import { pluginRegistry } from "@/lib/plugins/registry";
 *   pluginRegistry.register(myPlugin);
 *   const routes = pluginRegistry.getAllRoutes();
 */

import type { PluginDefinition, PluginValidation, PluginRoute, PluginWidget } from "./types";

class PluginRegistry {
  private plugins = new Map<string, PluginDefinition>();
  private activated = new Set<string>();

  /** Validate a plugin before registration */
  validate(plugin: PluginDefinition): PluginValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!plugin.metadata?.id) errors.push("Missing metadata.id");
    if (!plugin.metadata?.name) errors.push("Missing metadata.name");
    if (!plugin.metadata?.version) errors.push("Missing metadata.version");
    if (!plugin.metadata?.category) errors.push("Missing metadata.category");

    if (plugin.metadata?.id && this.plugins.has(plugin.metadata.id)) {
      errors.push(`Plugin "${plugin.metadata.id}" is already registered`);
    }

    // Check dependencies
    if (plugin.metadata?.requires) {
      for (const dep of plugin.metadata.requires) {
        if (!this.plugins.has(dep)) {
          warnings.push(`Dependency "${dep}" is not yet registered`);
        }
      }
    }

    // Validate routes
    if (plugin.routes) {
      for (const route of plugin.routes) {
        if (!route.path) errors.push("Route missing path");
        if (!route.component) errors.push(`Route "${route.path}" missing component`);
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /** Register a plugin (validates first) */
  register(plugin: PluginDefinition): PluginValidation {
    const validation = this.validate(plugin);
    if (!validation.valid) {
      console.error(`[PluginRegistry] Failed to register "${plugin.metadata?.id}":`, validation.errors);
      return validation;
    }

    this.plugins.set(plugin.metadata.id, plugin);
    console.log(`[PluginRegistry] Registered: ${plugin.metadata.name} (${plugin.metadata.id}) v${plugin.metadata.version}`);
    return validation;
  }

  /** Activate a plugin (calls onActivate) */
  async activate(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) throw new Error(`Plugin "${pluginId}" not found`);
    if (this.activated.has(pluginId)) return;

    if (plugin.onActivate) await plugin.onActivate();
    this.activated.add(pluginId);
  }

  /** Deactivate a plugin */
  async deactivate(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin || !this.activated.has(pluginId)) return;

    if (plugin.onDeactivate) await plugin.onDeactivate();
    this.activated.delete(pluginId);
  }

  /** Get all registered routes across plugins */
  getAllRoutes(): PluginRoute[] {
    const routes: PluginRoute[] = [];
    for (const plugin of this.plugins.values()) {
      if (plugin.routes) routes.push(...plugin.routes);
    }
    return routes;
  }

  /** Get all widgets, optionally filtered by slot */
  getWidgets(slot?: string): PluginWidget[] {
    const widgets: PluginWidget[] = [];
    for (const plugin of this.plugins.values()) {
      if (plugin.widgets) {
        for (const widget of plugin.widgets) {
          if (!slot || !widget.slots || widget.slots.includes(slot)) {
            widgets.push(widget);
          }
        }
      }
    }
    return widgets;
  }

  /** Get a specific plugin */
  get(pluginId: string): PluginDefinition | undefined {
    return this.plugins.get(pluginId);
  }

  /** Get all registered plugins */
  getAll(): PluginDefinition[] {
    return Array.from(this.plugins.values());
  }

  /** Check if a plugin is registered */
  has(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  /** Check if a plugin is activated */
  isActive(pluginId: string): boolean {
    return this.activated.has(pluginId);
  }
}

/** Singleton registry instance */
export const pluginRegistry = new PluginRegistry();
