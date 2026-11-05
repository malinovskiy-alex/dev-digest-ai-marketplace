// True when keyboard shortcuts must not fire because the user is typing.
export const isEditable = (el) => !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

export const focusSearch = () => { const el = document.getElementById('q'); if (el) el.focus(); };
