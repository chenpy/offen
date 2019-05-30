package router

import (
	"context"
	"errors"
	"net/http"

	"github.com/gorilla/handlers"
	"github.com/offen/offen/server/persistence"
	logrusmiddleware "github.com/offen/logrus-middleware"
	"github.com/sirupsen/logrus"
)

type router struct {
	db     persistence.Database
	logger *logrus.Logger
}

func (rt *router) logError(err error, message string) {
	if rt.logger != nil {
		rt.logger.WithError(err).Error(message)
	}
}

type contextKey int

const (
	cookieKey                   = "user"
	contextKeyCookie contextKey = iota
)

func (rt *router) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	switch r.URL.Path {
	case "/exchange":
		switch r.Method {
		case http.MethodGet:
			rt.getPublicKey(w, r)
		case http.MethodPost:
			rt.postUserSecret(w, r)
		default:
			respondWithError(w, errors.New("Method not allowed"), http.StatusMethodNotAllowed)
		}
	case "/events":
		c, err := r.Cookie(cookieKey)
		if err != nil {
			respondWithError(w, err, http.StatusBadRequest)
			return
		}
		if c.Value == "" {
			respondWithError(w, errors.New("received blank user identifier"), http.StatusBadRequest)
			return
		}

		r = r.WithContext(
			context.WithValue(r.Context(), contextKeyCookie, c.Value),
		)

		switch r.Method {
		case http.MethodGet:
			rt.getEvents(w, r)
		case http.MethodPost:
			rt.postEvents(w, r)
		default:
			respondWithError(w, errors.New("Method not allowed"), http.StatusMethodNotAllowed)
		}
	case "/status":
		rt.status(w, r)
	default:
		respondWithError(w, errors.New("Not found"), http.StatusNotFound)
	}
}

// New creates a new application router that reads and writes data
// to the given database implementation. In the context of the application
// this expects to be the only top level router in charge of handling all
// incoming HTTP requests.
func New(db persistence.Database, logger *logrus.Logger, origin string) http.Handler {
	router := &router{db, logger}
	withContentType := contentTypeMiddleware(router)
	withCors := corsMiddleware(withContentType, origin)
	l := logrusmiddleware.Middleware{
		Logger: logger,
	}
	withLogging := l.Handler(withCors, "")
	// it is important that the DNT middleware is the last one to wrap the
	// application as it should drop requests without performing anything else
	// before doing so
	withDNT := doNotTrackMiddleware(withLogging)
	withRecovery := handlers.RecoveryHandler(handlers.RecoveryLogger(logger))(withDNT)
	return withRecovery
}
