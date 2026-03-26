import { View, StyleSheet } from 'react-native';
import { Shimmer } from './Shimmer';

export function NewsCardSkeleton() {
  return (
    <View style={styles.card}>
      <Shimmer>
        {/* Image placeholder */}
        <View style={styles.image} />
      </Shimmer>

      <View style={styles.content}>
        <Shimmer>
          <View style={styles.titleLine} />
        </Shimmer>
        <Shimmer>
          <View style={styles.summaryLine1} />
        </Shimmer>
        <Shimmer>
          <View style={styles.summaryLine2} />
        </Shimmer>

        {/* Footer: source + date */}
        <View style={styles.footer}>
          <Shimmer>
            <View style={styles.sourceDot} />
          </Shimmer>
          <Shimmer>
            <View style={styles.dateDot} />
          </Shimmer>
        </View>

        {/* Button placeholder */}
        <Shimmer>
          <View style={styles.button} />
        </Shimmer>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  image: {
    width: '100%',
    height: 180,
    backgroundColor: '#e2e8f0',
  },
  content: {
    padding: 16,
    gap: 8,
  },
  titleLine: {
    height: 20,
    width: '75%',
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
  },
  summaryLine1: {
    height: 16,
    width: '100%',
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
  },
  summaryLine2: {
    height: 16,
    width: '66%',
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  sourceDot: {
    height: 12,
    width: 60,
    backgroundColor: '#e2e8f0',
    borderRadius: 6,
  },
  dateDot: {
    height: 12,
    width: 48,
    backgroundColor: '#e2e8f0',
    borderRadius: 6,
  },
  button: {
    height: 40,
    width: '100%',
    backgroundColor: '#e2e8f0',
    borderRadius: 12,
    marginTop: 4,
  },
});
