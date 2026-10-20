# Decisions: Winding dotted stage route

- Keep the existing 20-stage snake order, stickers, lock state, and mobile two-column layout.
- Replace straight dotted CSS borders with gentle S-shaped dotted SVG connectors in the existing green.
- Use one horizontal and one vertical vector asset so curves stay crisp across viewport sizes. Keep connectors behind stage buttons and out of pointer interaction.
- Desktop and mobile select the matching connector from their existing `data-*-next` direction attributes.
- Resume the pending deployment task after a separate UI commit.
