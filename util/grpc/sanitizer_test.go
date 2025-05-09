package grpc

import (
	"context"
	"regexp"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func TestSanitizer(t *testing.T) {
	s := NewSanitizer()

	ctx := ContextWithSanitizer(t.Context(), s)

	sanitizer, ok := SanitizerFromContext(ctx)
	require.True(t, ok)
	sanitizer.AddReplacement("/my-random/path", ".")

	res := s.Replace("error at /my-random/path/sub-dir: something went wrong")
	assert.Equal(t, "error at ./sub-dir: something went wrong", res)
}

func TestSanitizer_RegexReplacement(t *testing.T) {
	s := NewSanitizer()

	ctx := ContextWithSanitizer(t.Context(), s)

	sanitizer, ok := SanitizerFromContext(ctx)
	require.True(t, ok)

	sanitizer.AddRegexReplacement(regexp.MustCompile("(/my-random/path)"), ".")
	res := s.Replace("error at /my-random/path/something: something went wrong")
	assert.Equal(t, "error at ./something: something went wrong", res)
}

func TestErrorSanitizerUnaryServerInterceptor(t *testing.T) {
	interceptor := ErrorSanitizerUnaryServerInterceptor()

	_, err := interceptor(t.Context(), nil, nil, func(ctx context.Context, _ any) (any, error) {
		sanitizer, ok := SanitizerFromContext(ctx)
		require.True(t, ok)
		sanitizer.AddReplacement("/my-random/path", ".")
		return nil, status.Error(codes.Internal, "error at /my-random/path/sub-dir: something went wrong")
	})

	assert.EqualError(t, err, "rpc error: code = Internal desc = error at ./sub-dir: something went wrong")
}
