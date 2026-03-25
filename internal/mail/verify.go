package mail

import (
	"fmt"
	"log"
	"net/smtp"
	"net/url"
	"strings"

	"undangan_pernikahan/internal/config"
)

// SendVerification mengirim email konfirmasi atau mencatat link di log jika MAIL_HOST kosong.
func SendVerification(cfg config.Config, toEmail, token string) error {
	base := strings.TrimRight(cfg.FrontendURL, "/")
	link := base + "/verify-email?token=" + url.QueryEscape(token)

	if cfg.MailHost == "" {
		log.Printf("[mail] verifikasi email %s — buka: %s\n", toEmail, link)
		return nil
	}

	from := cfg.MailFrom
	if from == "" {
		from = cfg.MailUser
	}
	subject := "Konfirmasi pendaftaran Undangan"
	body := fmt.Sprintf("Halo,\r\n\r\nKonfirmasi akun dengan membuka tautan berikut:\r\n%s\r\n\r\nJika bukan kamu yang mendaftar, abaikan email ini.\r\n", link)

	msg := []byte(fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n%s",
		from, toEmail, subject, body))

	addr := fmt.Sprintf("%s:%s", cfg.MailHost, cfg.MailPort)
	auth := smtp.PlainAuth("", cfg.MailUser, cfg.MailPass, cfg.MailHost)
	return smtp.SendMail(addr, auth, from, []string{toEmail}, msg)
}
