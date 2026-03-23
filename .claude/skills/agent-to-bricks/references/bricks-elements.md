# Bricks Element JSON Reference

## Flat Format (database storage)

Each element has: id, name, label, parent, children[], settings{}

## Key Settings

- _padding, _margin: { top, right, bottom, left }
- _typography: { font-size, font-weight, color: { raw }, text-align }
- _background: { color: { raw } }
- _display, _direction, _justifyContent, _alignItems
- _gap, _gridTemplateColumns
- _width, _maxWidth, _height, _minHeight
- _borderRadius, _overflow, _position, _zIndex, _opacity
- _cssGlobalClasses: [class IDs], _cssClasses: "space separated"
- text: content string, tag: HTML tag, link: { type, url, newTab }
