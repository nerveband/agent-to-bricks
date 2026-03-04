package errors

import "fmt"

// CLIError is a structured error with a machine-readable code and exit code.
type CLIError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Hint    string `json:"hint,omitempty"`
	Exit    int    `json:"-"`
}

func (e *CLIError) Error() string {
	if e.Hint != "" {
		return fmt.Sprintf("%s. %s", e.Message, e.Hint)
	}
	return e.Message
}

func ConfigError(code, message, hint string) *CLIError {
	return &CLIError{Code: code, Message: message, Hint: hint, Exit: 2}
}

func APIError(code, message string) *CLIError {
	return &CLIError{Code: code, Message: message, Exit: 3}
}

func ValidationError(code, message string) *CLIError {
	return &CLIError{Code: code, Message: message, Exit: 4}
}

func ConflictError(message string) *CLIError {
	return &CLIError{Code: "CONTENT_CONFLICT", Message: message, Exit: 5}
}

// FromHTTPStatus maps an HTTP status code to the appropriate CLIError.
func FromHTTPStatus(status int, body string) *CLIError {
	switch status {
	case 401:
		return APIError("API_UNAUTHORIZED", fmt.Sprintf("HTTP 401: %s", body))
	case 403:
		return APIError("API_FORBIDDEN", fmt.Sprintf("HTTP 403: %s", body))
	case 404:
		return APIError("API_NOT_FOUND", fmt.Sprintf("HTTP 404: %s", body))
	case 409:
		return ConflictError(fmt.Sprintf("HTTP 409: %s", body))
	default:
		if status >= 500 {
			return APIError("API_SERVER_ERROR", fmt.Sprintf("HTTP %d: %s", status, body))
		}
		return APIError("API_ERROR", fmt.Sprintf("HTTP %d: %s", status, body))
	}
}
