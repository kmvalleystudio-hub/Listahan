import React from "react";
import { TextInput, type TextInputProps } from "react-native";

const AppTextInput = React.forwardRef<TextInput, TextInputProps>(function AppTextInput(props, ref) {
  return <TextInput ref={ref} {...props} />;
});

export default AppTextInput;
