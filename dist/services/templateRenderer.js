/**
 * Template rendering utilities
 * Provides helper functions for controllers to render views
 */
import ejs from 'ejs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');
const LAYOUTS_DIR = path.join(TEMPLATES_DIR, 'layouts');
const VIEWS_DIR = path.join(TEMPLATES_DIR, 'views');
/**
 * Render a view with or without layout
 *
 * @param viewName - Name of the view file (without .ejs extension)
 * @param data - Data to pass to the template
 * @param options - Rendering options (layout, page, title, etc.)
 * @returns Rendered HTML string
 */
export async function renderView(viewName, data = {}, options = {}) {
    const { layout = 'main', page = '', title = 'SPEAR', ...additionalData } = options;
    const viewPath = path.join(VIEWS_DIR, `${viewName}.ejs`);
    const viewContent = await ejs.renderFile(viewPath, {
        ...data,
        ...additionalData,
        page,
    });
    // Return without layout if layout is false
    if (layout === false) {
        return viewContent;
    }
    // Render with layout
    const layoutPath = path.join(LAYOUTS_DIR, `${layout}.ejs`);
    return await ejs.renderFile(layoutPath, {
        body: viewContent,
        title,
        page,
        ...additionalData,
    });
}
/**
 * Send rendered view as HTTP response
 *
 * @param res - Express response object
 * @param viewName - Name of the view file
 * @param data - Data to pass to the template
 * @param options - Rendering options
 */
export async function sendView(res, viewName, data = {}, options = {}) {
    try {
        const html = await renderView(viewName, data, options);
        res.type('html').send(html);
    }
    catch (error) {
        process.stderr.write(`Template rendering error: ${error}\n`);
        if (error instanceof Error && error.stack) {
            process.stderr.write(`${error.stack}\n`);
        }
        res.status(500).send('Error rendering template');
    }
}
/**
 * Send JSON or HTML response based on Accept header
 * Useful for controllers that support both API and web views
 *
 * @param res - Express response object
 * @param data - Data to send/render
 * @param viewName - View name for HTML rendering
 * @param options - Rendering options for HTML
 */
export async function sendViewOrJSON(res, data, viewName, options = {}) {
    const acceptsHtml = res.req.accepts('html');
    const acceptsJson = res.req.accepts('json');
    if (acceptsHtml && !acceptsJson) {
        await sendView(res, viewName, data, options);
    }
    else {
        res.json(data);
    }
}
//# sourceMappingURL=templateRenderer.js.map