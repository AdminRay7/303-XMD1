// lib/ui.js
// Shared UI helpers for buttons, lists, polls, and newsletter context.

// ==========================================================
//  BUTTONS (quick-reply)
// ==========================================================
/**
 * Build a quick-reply buttons payload.
 * @param {string} text    - message body
 * @param {Array}  buttons - array of { id, label }
 * @param {string} footer  - optional footer
 */
function buttons(text, buttonsList, footer = "") {
    return {
        text,
        footer,
        buttons: buttonsList.slice(0, 3).map(b => ({
            buttonId: b.id,
            buttonText: { displayText: b.label },
            type: 1
        })),
        headerType: 1
    };
}

// ==========================================================
//  LIST MESSAGE
// ==========================================================
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

// ==========================================================
//  POLL
// ==========================================================
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

// ==========================================================
//  NEWSLETTER CONTEXT  (fake "forwarded from channel")
// ==========================================================
/**
 * Wrap a message so it shows the "Forwarded" label and
 * a tappable channel line underneath — opens your newsletter.
 *
 * @param {string} jid        - e.g. '120363430114825309@newsletter'
 * @param {string} name       - channel name to display
 * @param {object} options
 *   - score     {number}  forwarding score (default 1)
 *   - forwarded {boolean} show "Forwarded" label (default true)
 *   - serverId  {number}  server message id (default -1)
 */
function channelContext(jid, name, options = {}) {
    const {
        score = 1,
        forwarded = true,
        serverId = -1
    } = options;

    return {
        forwardingScore: score,
        isForwarded: forwarded,
        forwardedNewsletterMessageInfo: {
            newsletterJid: jid,
            newsletterName: name,
            serverMessageId: serverId
        }
    };
}

// ==========================================================
//  CTA URL BUTTON  (interactive — opens a link)
// ==========================================================
/**
 * Build a modern interactive "cta_url" button payload.
 * Works on Baileys 6.7+ and renders more reliably than templateButtons.
 *
 * @param {string} text    - message body
 * @param {string} label   - button display text
 * @param {string} url     - link target
 * @param {string} footer  - optional footer
 */
function ctaButton(text, label, url, footer = "") {
    return {
        text,
        footer,
        interactiveButtons: [
            {
                name: 'cta_url',
                buttonParamsJson: JSON.stringify({
                    display_text: label,
                    url,
                    merchant_url: url
                })
            }
        ]
    };
}

// ==========================================================
//  CTA CALL BUTTON
// ==========================================================
function callButton(text, label, phoneNumber, footer = "") {
    return {
        text,
        footer,
        interactiveButtons: [
            {
                name: 'cta_call',
                buttonParamsJson: JSON.stringify({
                    display_text: label,
                    phone_number: phoneNumber
                })
            }
        ]
    };
}

// ==========================================================
//  CTA COPY BUTTON
// ==========================================================
function copyButton(text, label, codeToCopy, footer = "") {
    return {
        text,
        footer,
        interactiveButtons: [
            {
                name: 'cta_copy',
                buttonParamsJson: JSON.stringify({
                    display_text: label,
                    copy_code: codeToCopy
                })
            }
        ]
    };
}

// ==========================================================
//  MULTI-BUTTON  (combine several interactive buttons)
// ==========================================================
/**
 * Combine multiple interactive buttons into one message.
 *
 * @example
 *   multiButton('Choose:', [
 *     { type: 'url',  label: 'GitHub',  url: 'https://...' },
 *     { type: 'call', label: 'Call me', phone: '+254...' },
 *     { type: 'copy', label: 'Copy ID', code: 'XMD303' }
 *   ], 'footer text')
 */
function multiButton(text, items = [], footer = "") {
    const interactiveButtons = items.map(it => {
        switch (it.type) {
            case 'url':
                return {
                    name: 'cta_url',
                    buttonParamsJson: JSON.stringify({
                        display_text: it.label,
                        url: it.url,
                        merchant_url: it.url
                    })
                };
            case 'call':
                return {
                    name: 'cta_call',
                    buttonParamsJson: JSON.stringify({
                        display_text: it.label,
                        phone_number: it.phone
                    })
                };
            case 'copy':
                return {
                    name: 'cta_copy',
                    buttonParamsJson: JSON.stringify({
                        display_text: it.label,
                        copy_code: it.code
                    })
                };
            case 'reply':
                return {
                    name: 'quick_reply',
                    buttonParamsJson: JSON.stringify({
                        display_text: it.label,
                        id: it.id || it.label
                    })
                };
            default:
                return null;
        }
    }).filter(Boolean);

    return { text, footer, interactiveButtons };
}

// ==========================================================
//  CONVENIENCE WRAPPER — send with channel tag
// ==========================================================
/**
 * Merge a message payload with a channel context so the
 * forwarded-from-channel tag appears on the sent message.
 *
 * @example
 *   await conn.sendMessage(from, withChannel(
 *       { image: buf, caption: 'Hello' },
 *       config.newsletterJid, config.botName
 *   ));
 */
function withChannel(payload, jid, name, options = {}) {
    return {
        ...payload,
        contextInfo: {
            ...(payload.contextInfo || {}),
            ...channelContext(jid, name, options)
        }
    };
}

module.exports = {
    buttons,
    list,
    poll,
    channelContext,
    ctaButton,
    callButton,
    copyButton,
    multiButton,
    withChannel
};