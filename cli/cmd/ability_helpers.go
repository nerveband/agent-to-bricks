package cmd

func abilitySchemaHasContent(schema interface{}) bool {
	switch v := schema.(type) {
	case nil:
		return false
	case map[string]interface{}:
		return len(v) > 0
	case []interface{}:
		return len(v) > 0
	default:
		return true
	}
}

func abilitySchemaProperties(schema interface{}) map[string]interface{} {
	obj, ok := schema.(map[string]interface{})
	if !ok {
		return nil
	}
	props, ok := obj["properties"].(map[string]interface{})
	if !ok {
		return nil
	}
	return props
}
