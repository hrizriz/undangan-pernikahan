package repository

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"undangan_pernikahan/internal/model"
)

type User struct {
	pool *pgxpool.Pool
}

func NewUser(pool *pgxpool.Pool) *User {
	return &User{pool: pool}
}

var ErrEmailTaken = errors.New("email already registered")

// ErrInvalidVerifyToken token verifikasi tidak ada atau kadaluarsa.
var ErrInvalidVerifyToken = errors.New("invalid_or_expired_token")

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

// CreatePendingRegistration menyimpan user baru; email belum diverifikasi.
func (r *User) CreatePendingRegistration(ctx context.Context, email, passwordHash, verifyToken string, verifyExpires time.Time) (uuid.UUID, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	var id uuid.UUID
	err := r.pool.QueryRow(ctx,
		`INSERT INTO users (email, password_hash, email_verify_token, email_verify_expires_at)
		 VALUES ($1, $2, $3, $4) RETURNING id`,
		email, passwordHash, verifyToken, verifyExpires,
	).Scan(&id)
	if err != nil {
		if isUniqueViolation(err) {
			return uuid.Nil, ErrEmailTaken
		}
		return uuid.Nil, err
	}
	return id, nil
}

// VerifyEmail mengaktifkan akun berdasarkan token; mengembalikan user id.
func (r *User) VerifyEmail(ctx context.Context, token string) (uuid.UUID, error) {
	token = strings.TrimSpace(token)
	if token == "" {
		return uuid.Nil, ErrInvalidVerifyToken
	}
	var id uuid.UUID
	err := r.pool.QueryRow(ctx,
		`UPDATE users SET
			email_verified_at = now(),
			email_verify_token = NULL,
			email_verify_expires_at = NULL
		 WHERE email_verify_token = $1
		   AND email_verify_expires_at > now()
		 RETURNING id`,
		token,
	).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, ErrInvalidVerifyToken
	}
	if err != nil {
		return uuid.Nil, err
	}
	return id, nil
}

// UpsertSuperadmin membuat atau memperbarui akun superadmin (untuk seed).
func (r *User) UpsertSuperadmin(ctx context.Context, email, passwordHash string) error {
	email = strings.TrimSpace(strings.ToLower(email))
	_, err := r.pool.Exec(ctx,
		`INSERT INTO users (email, password_hash, role, email_verified_at)
		 VALUES ($1, $2, 'superadmin', now())
		 ON CONFLICT (email) DO UPDATE SET
			password_hash = EXCLUDED.password_hash,
			role = 'superadmin',
			email_verified_at = now(),
			email_verify_token = NULL,
			email_verify_expires_at = NULL`,
		email, passwordHash,
	)
	return err
}

// UserAuth data untuk verifikasi login (internal repository).
type UserAuth struct {
	ID              uuid.UUID
	Email           string
	PasswordHash    string
	EmailVerifiedAt *time.Time
	Role            string
}

func (r *User) GetByEmail(ctx context.Context, email string) (*UserAuth, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	var u UserAuth
	err := r.pool.QueryRow(ctx,
		`SELECT id, email, password_hash, email_verified_at, role FROM users WHERE email = $1`,
		email,
	).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.EmailVerifiedAt, &u.Role)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *User) GetByID(ctx context.Context, id uuid.UUID) (*model.User, error) {
	var u model.User
	err := r.pool.QueryRow(ctx,
		`SELECT id, email, role, email_verified_at, created_at FROM users WHERE id = $1`,
		id,
	).Scan(&u.ID, &u.Email, &u.Role, &u.EmailVerifiedAt, &u.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}
