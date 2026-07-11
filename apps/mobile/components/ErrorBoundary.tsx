import React from 'react';
import { View, Text, Pressable } from 'react-native';
import * as Sentry from '@sentry/react-native';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    Sentry.captureException(error, { contexts: { react: { componentStack: info.componentStack } } });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View className="flex-1 items-center justify-center px-6 bg-background gap-3">
          <Text className="text-lg font-bold text-foreground">Algo salió mal</Text>
          <Text className="text-sm text-muted-foreground text-center">
            La app tuvo un error inesperado. Ya se reportó automáticamente.
          </Text>
          <Pressable
            onPress={() => this.setState({ hasError: false })}
            className="bg-primary rounded-xl px-6 py-3 mt-2"
            accessibilityRole="button"
            accessibilityLabel="Reintentar"
          >
            <Text className="text-white font-semibold">Reintentar</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}
