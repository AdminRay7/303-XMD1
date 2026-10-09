// lib/ui.js
// Shared UI helpers for buttons, lists, and confirmations.

/**
 * Build a quick-reply buttons payload.
 * @param {string} text    - message body
 * @param {Array}  buttons - array of { id, label }
 * @param {string} footer  - optional footer
 */
function buttons(text, buttons, footer = "") {
    return {
        text,
        footer,
        buttons: buttons.slice(0, 3).map(b => ({
            buttonId: b.id,
            buttonText: { displayText: b.label },
            type: 1
        })),
        headerType: 1
    };
}

/**
 * Build a list message.
 * @param {string} text     - main body
 * @param {string} title    - button label
 * @param {Array}  sections - array of { title, rows: [{ id, title, description }] }
 */
function list(text, title, sections, footer = "") {
    return {
        text,
        footer,
        title,
        buttonText: title,
        sections: sections.map(s => ({
            title: s.title,
            rows: s.rows.map(r => ({
                title: r.title,
                rowId: r.id,
                description: r.description || ""
            }))
        })),
        listType: 1,
        headerType: 1
    };
}

/**
 * Build a poll payload.
 */
function poll(name, options, selectable = 1) {
    return {
        poll: {
            name,
            values: options.slice(0, 12),
            selectableCount: selectable
        }
    };
}

module.exports = { buttons, list, poll };