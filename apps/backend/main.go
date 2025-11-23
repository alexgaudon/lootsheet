package main

import (
	"fmt"
	"log"
	"slices"
	"strings"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

func main() {
	app := pocketbase.New()

	// fires for every auth collection
	app.OnRecordAuthRequest().BindFunc(func(e *core.RecordAuthRequestEvent) error {
		metaMap, ok := e.Meta.(map[string]any)
		if !ok {
			return e.Next()
		}

		rawID, exists := metaMap["id"]
		if !exists {
			return e.Next()
		}

		discordID, ok := rawID.(string)
		if !ok || discordID == "" {
			return e.Next()
		}

		if e.Record.GetString("discordId") == discordID {
			return e.Next()
		}

		e.Record.Set("discordId", discordID)

		err := app.Save(e.Record)

		if err != nil {
			app.Logger().Error(fmt.Sprintf("failed to save discordId to user record: %v", err))
		}

		return e.Next()
	})

	app.OnRecordCreateRequest("users").BindFunc(func(e *core.RecordRequestEvent) error {
		name := e.Record.GetString("name")
		if idx := strings.Index(name, "#"); idx != -1 {
			e.Record.Set("name", name[:idx])
		}
		return e.Next()
	})

	// Handle invitation acceptance - add user to group when invitation is accepted
	app.OnRecordUpdateRequest("group_invitations").BindFunc(func(e *core.RecordRequestEvent) error {
		accepted := e.Record.GetBool("accepted")
		used := e.Record.GetBool("used")

		if !accepted || !used {
			return e.Next()
		}

		if e.Auth == nil {
			return fmt.Errorf("missing authenticated user on invitation acceptance")
		}

		userId := e.Auth.Id

		groupId := e.Record.GetString("group")
		group, err := app.FindRecordById("groups", groupId)
		if err != nil {
			return err
		}

		members := group.GetStringSlice("members")
		if !slices.Contains(members, userId) {
			members = append(members, userId)
			group.Set("members", members)

			if err := app.Save(group); err != nil {
				return err
			}
		}

		return e.Next()
	})

	mountFs(app)

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}
