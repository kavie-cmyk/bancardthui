# Hoenn theme artwork

- `coast.webp`: generated for this project with ImageGen from the approved Ruby/Sapphire interface concept; optimized WebP background. No interface or inventory data is baked into the image.
- Pokémon sprites (`kyogre`, `mudkip`, `treecko`, `torchic`): downloaded from https://github.com/PokeAPI/sprites/tree/master/sprites/pokemon/versions/generation-iii/ruby-sapphire .
- Item sprites: downloaded from https://github.com/PokeAPI/sprites/tree/master/sprites/items .
- Pokémon characters and game artwork belong to their respective rights holders. PokeAPI is the download source, not the creator of these game sprites.

All decorative images have empty alternative text and are hidden from assistive technology where appropriate. Actual trading-card artwork continues to use the existing TCGdex / uploaded-image logic.

## Cream inventory palette (2026-10-24)

The inventory keeps its own coastal scene. CSS adds a 52% cream overlay and reduces saturation; floating background sprites are faded and stationary. Content panels stay fully opaque, with softer single borders and muted blue title bars. These rules are scoped to `html.theme-rs`; the other theme and inventory behavior are unchanged.
