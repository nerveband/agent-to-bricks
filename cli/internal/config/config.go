package config

import (
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Site SiteConfig `yaml:"site"`
	LLM  LLMConfig  `yaml:"llm"`
}

type SiteConfig struct {
	URL    string `yaml:"url"`
	APIKey string `yaml:"api_key"`
}

type LLMConfig struct {
	Provider    string  `yaml:"provider"`
	APIKey      string  `yaml:"api_key"`
	Model       string  `yaml:"model"`
	BaseURL     string  `yaml:"base_url"`
	Temperature float64 `yaml:"temperature"`
}

func DefaultPath() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return filepath.Join(".agent-to-bricks", "config.yaml")
	}
	return filepath.Join(home, ".agent-to-bricks", "config.yaml")
}

func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}
	return &cfg, nil
}

func (c *Config) Save(path string) error {
	data, err := yaml.Marshal(c)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}
	return os.WriteFile(path, data, 0600)
}
