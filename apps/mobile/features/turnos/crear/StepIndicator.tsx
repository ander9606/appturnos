import React from 'react';
import { View } from 'react-native';

export function StepIndicator({ current }: { current: number }) {
  return (
    <View className="flex-row items-center justify-center gap-2 py-4 px-5">
      {[1, 2, 3].map((s) => (
        <React.Fragment key={s}>
          <View
            className={`h-2 rounded-full ${s <= current ? 'bg-primary-500' : 'bg-muted'}`}
            style={{ width: s === current ? 28 : 8 }}
          />
        </React.Fragment>
      ))}
    </View>
  );
}
