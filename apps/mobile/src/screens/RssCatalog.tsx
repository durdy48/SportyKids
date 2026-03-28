import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  SectionList,
  Switch,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import type { RssSource } from '@sportykids/shared';
import { COLORS, t, getSportLabel } from '@sportykids/shared';
import type { ThemeColors } from '../lib/theme';
import { fetchSourceCatalog, updateUser } from '../lib/api';
import { useUser } from '../lib/user-context';

interface Section {
  title: string;
  sport: string;
  data: RssSource[];
}

export function RssCatalogScreen() {
  const { user, locale, setUser, colors } = useUser();
  const styles = createStyles(colors);
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    loadCatalog();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user?.selectedFeeds) {
      setSelectedIds(new Set(user.selectedFeeds));
    }
  }, [user?.selectedFeeds]);

  const loadCatalog = async () => {
    try {
      const result = await fetchSourceCatalog();
      const grouped: Record<string, RssSource[]> = {};
      for (const source of result.sources) {
        if (!grouped[source.sport]) grouped[source.sport] = [];
        grouped[source.sport].push(source);
      }

      const sectionList: Section[] = Object.entries(grouped)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([sport, sources]) => ({
          title: `${getSportLabel(sport, locale)} (${sources.length})`,
          sport,
          data: sources,
        }));

      setSections(sectionList);
    } catch {
      Alert.alert(t('errors.connection_error', locale));
    } finally {
      setLoading(false);
    }
  };

  const toggleSource = useCallback((sourceId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sourceId)) {
        next.delete(sourceId);
      } else {
        next.add(sourceId);
      }
      return next;
    });
    setDirty(true);
  }, []);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const updated = await updateUser(user.id, {
        selectedFeeds: Array.from(selectedIds),
      });
      setUser(updated);
      setDirty(false);
      Alert.alert(t('notifications.saved', locale));
    } catch {
      Alert.alert(t('errors.connection_error', locale));
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item }: { item: RssSource }) => (
    <View style={styles.sourceCard}>
      <View style={styles.sourceInfo}>
        <Text style={styles.sourceName}>{item.name}</Text>
        <Text style={styles.sourceDescription} numberOfLines={2}>
          {item.description}
        </Text>
        <View style={styles.sourceMeta}>
          <Text style={styles.sourceMetaText}>
            {item.country} · {item.language.toUpperCase()}
          </Text>
          {item.isCustom && (
            <View style={styles.customBadge}>
              <Text style={styles.customBadgeText}>{t('sources.custom_badge', locale)}</Text>
            </View>
          )}
        </View>
      </View>
      <Switch
        value={selectedIds.has(item.id)}
        onValueChange={() => toggleSource(item.id)}
        trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
        thumbColor={selectedIds.has(item.id) ? colors.blue : colors.border}
      />
    </View>
  );

  const renderSectionHeader = ({ section }: { section: Section }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.blue} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled
        contentContainerStyle={{ paddingBottom: 80 }}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{t('sources.catalog_title', locale)}</Text>
            <Text style={styles.headerSubtitle}>{t('sources.catalog_subtitle', locale)}</Text>
          </View>
        }
      />
      {dirty && (
        <View style={styles.saveBar}>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>
                {t('sources.selected_count', locale).replace('{{count}}', String(selectedIds.size))} — {t('favorites.save', locale)}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.muted,
    marginTop: 4,
  },
  sectionHeader: {
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    textTransform: 'capitalize',
  },
  sourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sourceInfo: {
    flex: 1,
    marginRight: 12,
  },
  sourceName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  sourceDescription: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
    lineHeight: 18,
  },
  sourceMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  sourceMetaText: {
    fontSize: 12,
    color: colors.muted,
  },
  customBadge: {
    backgroundColor: colors.blue + '15',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  customBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.blue,
  },
  saveBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  saveButton: {
    backgroundColor: COLORS.blue,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  });
}
