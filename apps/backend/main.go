package main

import (
	"fmt"
	"log"
	"strings"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

func main() {
	app := pocketbase.New()

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
		isMember := false
		for _, member := range members {
			if member == userId {
				isMember = true
				break
			}
		}

		if !isMember {
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
