import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { accentFromShowUp } from '@/lib/color';
import {
  MONSTER_LAYOUT,
  monsterAssetFor,
  MonsterRecipe,
  Recipe,
  SHAPE_BODIES,
  SHAPE_FACES,
  SHAPE_HAND,
  ShapeRecipe,
  Sprite,
} from '@/lib/recipe';
import { Anchor, BODY_PX, SHAPE_CANVAS, SHAPE_SKELETONS } from '@/lib/skeleton';

interface PixelFaceProps {
  recipe: Recipe;
  /** Side of the body's bounding box in px. Hands render outside it. */
  size?: number;
  /** Optional show_up text used as the palette when recipe.palette is null. */
  showUp?: string | null;
}

export function PixelFace({ recipe, size = 96, showUp }: PixelFaceProps) {
  const palette = recipe.palette ?? accentFromShowUp(showUp).light;

  return recipe.source === 'shape' ? (
    <ShapeCharacter recipe={recipe} size={size} palette={palette} />
  ) : (
    <MonsterCharacter recipe={recipe} size={size} palette={palette} />
  );
}

interface CharacterProps<T extends Recipe> {
  recipe: T;
  size: number;
  palette: string;
}

/**
 * Places a sprite by the skeleton: the anchor is the sprite's centre in
 * body-box fractions, and the sprite renders at its native pack size scaled to
 * the body. `originX` shifts the body box inside the wider hand canvas.
 */
function placeSprite(sprite: Sprite, anchor: Anchor, size: number, originX: number) {
  const width = (sprite.size.w / BODY_PX) * size * anchor.scale;
  const height = (sprite.size.h / BODY_PX) * size * anchor.scale;

  return {
    width,
    height,
    left: originX + anchor.x * size - width / 2,
    top: anchor.y * size - height / 2,
  };
}

const BODY_ANCHOR: Anchor = { x: 0.5, y: 0.5, scale: 1 };

function ShapeCharacter({ recipe, size, palette }: CharacterProps<ShapeRecipe>) {
  const skeleton = SHAPE_SKELETONS[recipe.base];
  const body = SHAPE_BODIES[recipe.base];
  const face = SHAPE_FACES[recipe.top];
  const originX = ((SHAPE_CANVAS.w - 1) * size) / 2;

  return (
    <View style={{ width: size * SHAPE_CANVAS.w, height: size * SHAPE_CANVAS.h }}>
      {/* The pack's one hand sprite has its thumb toward the viewer's left, so
          it goes on the character's right as-is and mirrors for the left. */}
      <Image
        source={SHAPE_HAND.image}
        style={[styles.layer, placeSprite(SHAPE_HAND, skeleton.handRight, size, originX)]}
        contentFit="contain"
        tintColor={palette}
      />
      <Image
        source={SHAPE_HAND.image}
        style={[
          styles.layer,
          styles.mirrored,
          placeSprite(SHAPE_HAND, skeleton.handLeft, size, originX),
        ]}
        contentFit="contain"
        tintColor={palette}
      />
      <Image
        source={body.image}
        style={[styles.layer, placeSprite(body, BODY_ANCHOR, size, originX)]}
        contentFit="contain"
        tintColor={palette}
      />
      {/* The look: the only layer a look changes. */}
      <Image
        source={face.image}
        style={[styles.layer, placeSprite(face, skeleton.face, size, originX)]}
        contentFit="contain"
      />
    </View>
  );
}

/** Monster bodies come with a face drawn in, so overlays sit on the body canvas. */
function MonsterCharacter({ recipe, size, palette }: CharacterProps<MonsterRecipe>) {
  return (
    <View style={{ width: size, height: size }}>
      <Image
        source={monsterAssetFor('base', recipe.base)}
        style={[styles.layer, layerBox(MONSTER_LAYOUT.base, size)]}
        contentFit="contain"
        tintColor={palette}
      />
      {recipe.hair ? (
        <Image
          source={monsterAssetFor('hair', recipe.hair)}
          style={[styles.layer, layerBox(MONSTER_LAYOUT.hair, size)]}
          contentFit="contain"
        />
      ) : null}
      <Image
        source={monsterAssetFor('top', recipe.top)}
        style={[styles.layer, layerBox(MONSTER_LAYOUT.top, size)]}
        contentFit="contain"
      />
    </View>
  );
}

function layerBox(box: { w: number; h: number; x: number; y: number }, size: number) {
  return { width: size * box.w, height: size * box.h, left: size * box.x, top: size * box.y };
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
  },
  mirrored: {
    transform: [{ scaleX: -1 }],
  },
});
