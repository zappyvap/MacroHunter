// wrapper components that let us use className strings (like "result-card")
// instead of passing style objects everywhere. getStyleFromClassName splits the
// className string and maps each name to its matching entry in styles.js.
import {
  Image as RNImage,
  SafeAreaView as RNSafeAreaView,
  Text as RNText,
  TextInput as RNTextInput,
  TouchableOpacity as RNTouchableOpacity,
  View as RNView,
} from 'react-native';
import styles from '../constants/styles';
import colors from './colors';

export function getStyleFromClassName(className, styleMap = styles) {
  if (!className) return undefined;

  return className
    .split(/\s+/)
    .map((name) => styleMap[name])
    .filter(Boolean);
}

export function View({ className, style, ...props }) {
  return <RNView {...props} style={[getStyleFromClassName(className), style]} />;
}

export function Text({ className, style, ...props }) {
  return <RNText {...props} style={[{ fontFamily: 'Inter-Regular', color: colors.text }, getStyleFromClassName(className), style]} />;
}

export function TextInput({ className, style, ...props }) {
  return <RNTextInput {...props} placeholderTextColor={colors.muted} style={[{ fontFamily: 'Inter-Regular', color: colors.text }, getStyleFromClassName(className), style]} />;
}

export function TouchableOpacity({ className, style, ...props }) {
  return <RNTouchableOpacity {...props} style={[getStyleFromClassName(className), style]} />;
}

export function Image({ className, style, ...props }) {
  return <RNImage {...props} style={[getStyleFromClassName(className), style]} />;
}

export function SafeAreaView({ className, style, ...props }) {
  return <RNSafeAreaView {...props} style={[getStyleFromClassName(className), style]} />;
}