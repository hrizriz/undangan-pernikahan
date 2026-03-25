package storage

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"net/url"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type S3Config struct {
	Endpoint        string
	Region          string
	Bucket          string
	AccessKeyID     string
	SecretAccessKey string
	PublicBaseURL   string
}

type S3 struct {
	client        *s3.Client
	bucket        string
	publicBaseURL string
}

func NewS3(ctx context.Context, cfg S3Config) (*S3, error) {
	if strings.TrimSpace(cfg.Endpoint) == "" {
		return nil, errors.New("S3_ENDPOINT wajib di-set")
	}
	if strings.TrimSpace(cfg.Region) == "" {
		cfg.Region = "us-east-1"
	}
	if strings.TrimSpace(cfg.Bucket) == "" {
		return nil, errors.New("S3_BUCKET wajib di-set")
	}
	if strings.TrimSpace(cfg.AccessKeyID) == "" || strings.TrimSpace(cfg.SecretAccessKey) == "" {
		return nil, errors.New("S3_ACCESS_KEY_ID dan S3_SECRET_ACCESS_KEY wajib di-set")
	}
	pub := strings.TrimSpace(cfg.PublicBaseURL)
	if pub == "" {
		pub = strings.TrimSpace(cfg.Endpoint)
	}
	if _, err := url.ParseRequestURI(pub); err != nil {
		return nil, fmt.Errorf("S3_PUBLIC_BASE_URL tidak valid: %w", err)
	}

	awsCfg, err := config.LoadDefaultConfig(ctx,
		config.WithRegion(cfg.Region),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(cfg.AccessKeyID, cfg.SecretAccessKey, "")),
		config.WithEndpointResolverWithOptions(aws.EndpointResolverWithOptionsFunc(
			func(service, region string, _ ...any) (aws.Endpoint, error) {
				if service == s3.ServiceID {
					return aws.Endpoint{URL: cfg.Endpoint, SigningRegion: cfg.Region, HostnameImmutable: true}, nil
				}
				return aws.Endpoint{}, &aws.EndpointNotFoundError{}
			},
		)),
	)
	if err != nil {
		return nil, err
	}

	client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		// MinIO (dan banyak S3-compatible) biasanya membutuhkan path-style.
		o.UsePathStyle = true
	})

	return &S3{
		client:        client,
		bucket:        cfg.Bucket,
		publicBaseURL: strings.TrimRight(pub, "/"),
	}, nil
}

func (s *S3) PutPublicObject(ctx context.Context, key string, body []byte, contentType string) (string, error) {
	key = strings.TrimLeft(strings.TrimSpace(key), "/")
	if key == "" {
		return "", errors.New("key kosong")
	}
	if strings.TrimSpace(contentType) == "" {
		contentType = "application/octet-stream"
	}
	_, err := s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(key),
		Body:        bytes.NewReader(body),
		ContentType: aws.String(contentType),
	})
	if err != nil {
		return "", err
	}

	// URL path-style: <base>/<bucket>/<key>
	u, err := url.Parse(s.publicBaseURL)
	if err != nil {
		return "", err
	}
	u.Path = strings.TrimRight(u.Path, "/") + "/" + url.PathEscape(s.bucket) + "/" + escapePathSegments(key)
	return u.String(), nil
}

func escapePathSegments(p string) string {
	parts := strings.Split(p, "/")
	for i := range parts {
		parts[i] = url.PathEscape(parts[i])
	}
	return strings.Join(parts, "/")
}

