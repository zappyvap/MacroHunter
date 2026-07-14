import {
  Image as RNImage,
  SafeAreaView as RNSafeAreaView,
  Text as RNText,
  TextInput as RNTextInput,
  TouchableOpacity as RNTouchableOpacity,
  View as RNView,
} from 'react-native';
import styles from '../constants/styles';

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
  return <RNText {...props} style={[getStyleFromClassName(className), style]} />;
}

export function TextInput({ className, style, ...props }) {
  return <RNTextInput {...props} style={[getStyleFromClassName(className), style]} />;
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