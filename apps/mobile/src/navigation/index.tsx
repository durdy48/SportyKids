import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

export const navigationRef = createNavigationContainerRef();
import { Text, TouchableOpacity } from 'react-native';
import { t } from '@sportykids/shared';
import { useUser } from '../lib/user-context';
import { haptic } from '../lib/haptics';
import { HomeFeedScreen } from '../screens/HomeFeed';
import { ReelsScreen } from '../screens/Reels';
import { QuizScreen } from '../screens/Quiz';
import { CollectionScreen } from '../screens/Collection';
import { FavoriteTeamScreen } from '../screens/FavoriteTeam';
import { ParentalControlScreen } from '../screens/ParentalControl';
import { OnboardingScreen } from '../screens/Onboarding';
import { RssCatalogScreen } from '../screens/RssCatalog';
import { LoginScreen } from '../screens/Login';
import { RegisterScreen } from '../screens/Register';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function LanguageToggle() {
  const { locale, setLocale, colors } = useUser();
  const nextLocale = locale === 'es' ? 'en' : 'es';
  const flag = locale === 'es' ? '🇪🇸' : '🇬🇧';
  return (
    <TouchableOpacity
      onPress={() => setLocale(nextLocale)}
      style={{ marginRight: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.border }}
    >
      <Text style={{ fontSize: 16 }}>{flag}</Text>
      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.muted, marginLeft: 4 }}>{locale.toUpperCase()}</Text>
    </TouchableOpacity>
  );
}

function MainTabs() {
  const { locale, colors } = useUser();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        headerTitleStyle: { fontWeight: '600', fontSize: 18, color: colors.text },
        headerStyle: { backgroundColor: colors.surface },
        headerRight: () => <LanguageToggle />,
        tabBarActiveTintColor: colors.blue,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { borderTopColor: colors.border, backgroundColor: colors.surface },
      }}
      screenListeners={{
        tabPress: () => haptic('selection'),
      }}
    >
      <Tab.Screen
        name="HomeFeed"
        component={HomeFeedScreen}
        options={{
          title: t('nav.news', locale),
          tabBarIcon: ({ color: _color }) => <Text style={{ fontSize: 20 }}>📰</Text>,
        }}
      />
      <Tab.Screen
        name="Reels"
        component={ReelsScreen}
        options={{
          title: t('nav.reels', locale),
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          tabBarIcon: ({ color: _color }) => <Text style={{ fontSize: 20 }}>🎬</Text>,
        }}
      />
      <Tab.Screen
        name="Quiz"
        component={QuizScreen}
        options={{
          title: t('nav.quiz', locale),
          tabBarIcon: ({ color: _color }) => <Text style={{ fontSize: 20 }}>🧠</Text>,
        }}
      />
      <Tab.Screen
        name="Collection"
        component={CollectionScreen}
        options={{
          title: t('nav.collection', locale),
          tabBarIcon: ({ color: _color }) => <Text style={{ fontSize: 20 }}>🏆</Text>,
        }}
      />
      <Tab.Screen
        name="FavoriteTeam"
        component={FavoriteTeamScreen}
        options={{
          title: t('nav.my_team', locale),
          tabBarIcon: ({ color: _color }) => <Text style={{ fontSize: 20 }}>⚽</Text>,
        }}
      />
      <Tab.Screen
        name="Parents"
        component={ParentalControlScreen}
        options={{
          title: t('nav.parents', locale),
          tabBarIcon: ({ color: _color }) => <Text style={{ fontSize: 20 }}>🔒</Text>,
        }}
      />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const { user, loading, locale } = useUser();

  if (loading) return null;

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen
              name="RssCatalog"
              component={RssCatalogScreen}
              options={{
                headerShown: true,
                title: t('sources.catalog_title', locale),
              }}
            />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
