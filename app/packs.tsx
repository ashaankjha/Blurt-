import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';

import type { PackTag } from '../content/schema';
import { contentService } from '../src/content';
import { useGame } from '../src/store/game';
import { useSettings } from '../src/store/settings';
import { AppText, Button, Chip, IconButton, PackTile, Screen, SearchField, useTheme } from '../src/ui';

const TAG_FILTERS: { tag: PackTag; label: string }[] = [
  { tag: 'family', label: 'Family' },
  { tag: 'kids', label: 'Kids' },
  { tag: 'hard', label: 'Hard' },
  { tag: 'local', label: 'Local' },
  { tag: 'adult', label: 'After Dark 18+' },
];

const goBack = () => (router.canGoBack() ? router.back() : router.replace('/setup'));

export default function PackPicker() {
  const { colors, spacing } = useTheme();
  const afterDarkEnabled = useSettings((s) => s.afterDarkEnabled);
  const packIds = useGame((s) => s.draft.packIds);
  const togglePack = useGame((s) => s.togglePack);
  const setPacks = useGame((s) => s.setPacks);

  const [query, setQuery] = useState('');
  const [tags, setTags] = useState<PackTag[]>([]);

  const packs = useMemo(() => contentService.listPacks({ includeAdult: afterDarkEnabled }), [afterDarkEnabled]);
  const filters = TAG_FILTERS.filter((f) => f.tag !== 'adult' || afterDarkEnabled);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return packs.filter(
      (p) =>
        (q === '' || p.name.toLowerCase().includes(q)) && (tags.length === 0 || p.tags.some((t) => tags.includes(t))),
    );
  }, [packs, query, tags]);

  // Only count packs that are actually available (After Dark may have been switched off).
  const selected = packs.filter((p) => packIds.includes(p.id));
  const selectedPhrases = selected.reduce((n, p) => n + p.phraseCount, 0);
  const allVisibleSelected = visible.length > 0 && visible.every((p) => packIds.includes(p.id));

  const toggleTag = (tag: PackTag) =>
    setTags((cur) => (cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag]));

  const selectAllVisible = () => setPacks([...new Set([...packIds, ...visible.map((p) => p.id)])]);
  const selectNone = () => {
    const hide = new Set(visible.map((p) => p.id));
    setPacks(packIds.filter((id) => !hide.has(id)));
  };
  const filtered = query.trim() !== '' || tags.length > 0;

  return (
    <Screen testID="packs-screen">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <IconButton icon="←" accessibilityLabel="Back" onPress={goBack} testID="packs-back" />
        <AppText variant="title" accessibilityRole="header">
          Choose packs
        </AppText>
      </View>

      <View style={{ gap: spacing.sm, paddingVertical: spacing.sm }}>
        <SearchField value={query} onChangeText={setQuery} placeholder="Search packs" testID="packs-search" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          {filters.map((f) => (
            <Chip
              key={f.tag}
              label={f.label}
              selected={tags.includes(f.tag)}
              onPress={() => toggleTag(f.tag)}
              testID={`packs-tag-${f.tag}`}
            />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Button
              label={filtered ? 'Select shown' : 'Select all'}
              size="sm"
              variant="secondary"
              fullWidth
              disabled={allVisibleSelected}
              onPress={selectAllVisible}
              testID="packs-select-all"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label={filtered ? 'Clear shown' : 'Select none'}
              size="sm"
              variant="ghost"
              fullWidth
              disabled={!visible.some((p) => packIds.includes(p.id))}
              onPress={selectNone}
              testID="packs-select-none"
            />
          </View>
        </View>
      </View>

      <FlatList
        style={{ flex: 1 }}
        data={visible}
        keyExtractor={(p) => p.id}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.sm }}
        contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.md }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <AppText variant="body" align="center" color={colors.textMuted}>
            No packs match. Try another search or filter.
          </AppText>
        }
        renderItem={({ item }) => (
          <View style={{ flex: 1 / 2 }}>
            <PackTile
              pack={item}
              selected={packIds.includes(item.id)}
              onToggle={() => togglePack(item.id)}
              testID={`pack-${item.id}`}
            />
          </View>
        )}
      />

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingTop: spacing.sm,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <View style={{ flex: 1 }} accessible accessibilityLiveRegion="polite">
          <AppText variant="label" testID="packs-selected-count">
            {selected.length} selected
          </AppText>
          <AppText variant="caption" color={colors.textMuted}>
            {selectedPhrases.toLocaleString()} phrases
          </AppText>
        </View>
        <Button label="Done" variant="primary" size="lg" onPress={goBack} testID="packs-done" />
      </View>
    </Screen>
  );
}
